
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import json
import smtplib
import io
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path

from services.google_drive import GoogleDriveService
from config import STANDARD_TASKS
from database import Database

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
drive_service = GoogleDriveService()

# Schedules data file
SCHEDULES_FILE = Path(__file__).parent / "data" / "schedules.json"

def get_schedules():
    if SCHEDULES_FILE.exists():
        with open(SCHEDULES_FILE, 'r') as f:
            return json.load(f)
    return []

def save_schedules(schedules):
    SCHEDULES_FILE.parent.mkdir(exist_ok=True)
    with open(SCHEDULES_FILE, 'w') as f:
        json.dump(schedules, f, indent=2)

# Models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rig_down: Optional[str] = None
    pic_email: Optional[str] = None
    status: str = "Ongoing"

class TaskCreate(BaseModel):
    title: str
    project_id: str
    code: Optional[str] = None
    category: Optional[str] = None
    status: str = "Upcoming"
    description: Optional[str] = ""

class ScheduleCreate(BaseModel):
    project_id: str
    project_name: str
    well_name: str
    mwt_plan_date: str
    hse_meeting_date: str
    pic_name: str
    assigned_to_email: str

# Email sending function
def send_schedule_email(schedule: dict):
    """Send email notification about schedule via Resend API"""
    import resend
    
    try:
        # Get Resend API key from environment
        resend_api_key = os.getenv('RESEND_API_KEY')
        
        if not resend_api_key:
            print("[EMAIL] Resend API key not configured (RESEND_API_KEY)")
            return False
        
        resend.api_key = resend_api_key
        
        recipient = schedule['assigned_to_email']
        subject = f"Schedule Notification: {schedule['project_name']}"
        
        # Create HTML email body
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="background: #E50914; color: white; padding: 20px; border-radius: 8px;">
                <h2 style="margin: 0;">CSMS Schedule Notification</h2>
            </div>
            <div style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin-top: 10px;">
                <p>Dear <strong>{schedule['pic_name']}</strong>,</p>
                <p>You have been assigned to the following schedule:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #fff;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Project</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{schedule['project_name']}</td>
                    </tr>
                    <tr style="background: #fff;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Well</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{schedule['well_name']}</td>
                    </tr>
                    <tr style="background: #fff;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>MWT Plan Date</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd; color: #E50914; font-weight: bold;">{schedule['mwt_plan_date']}</td>
                    </tr>
                    <tr style="background: #fff;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>HSE Committee Meeting</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd; color: #46D369; font-weight: bold;">{schedule['hse_meeting_date']}</td>
                    </tr>
                </table>
                <p style="margin-top: 20px;">Please mark these dates in your calendar.</p>
                <p>Best regards,<br><strong>CSMS Project Management System</strong><br>Weatherford</p>
            </div>
        </body>
        </html>
        """
        
        print(f"[EMAIL] Sending via Resend API...")
        print(f"[EMAIL] To: {recipient}")
        
        # Send via Resend API
        params = {
            "from": "CSMS <onboarding@resend.dev>",
            "to": [recipient],
            "subject": subject,
            "html": body_html
        }
        
        response = resend.Emails.send(params)
        
        print(f"[EMAIL] Successfully sent! ID: {response.get('id', 'unknown')}")
        return True
        
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return False

# Routes

@app.get("/")
def read_root():
    return {"status": "ok", "service": "CSMS Backend"}

# --- Projects ---

@app.get("/projects")
def list_projects():
    return db.get_projects()

@app.post("/projects")
def create_project(project: ProjectCreate, background_tasks: BackgroundTasks):
    # 1. Create in DB
    new_project = db.create_project(project.dict())
    
    # 2. Trigger Folder Creation (in background)
    background_tasks.add_task(drive_service.find_or_create_folder, new_project['name'])
    
    # 3. Generate Standard Tasks
    for std_task in STANDARD_TASKS:
        task_data = {
            "title": std_task['title'],
            "project_id": new_project['id'],
            "code": std_task['code'],
            "category": std_task['category'],
            "status": "Upcoming"
        }
        db.create_task(task_data)

    # 4. Trigger Excel Update
    from services.excel_sync import ExcelSyncService
    excel_service = ExcelSyncService(drive_service)
    background_tasks.add_task(excel_service.sync_to_drive, db.get_projects(), db.get_tasks())
    
    return new_project

@app.get("/projects/{project_id}")
def get_project_details(project_id: str):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = db.get_tasks(project_id)
    return {"project": project, "tasks": tasks}

@app.get("/projects/{project_id}/report")
def generate_project_report(project_id: str, mode: str = "download"):
    """Generate a comprehensive PDF report for a project with all attachments embedded
    
    Args:
        mode: 'download' to download file, 'preview' to view inline
    """
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image as RLImage
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from PIL import Image as PILImage
    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab not installed. Run: pip install reportlab pillow")
    
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = db.get_tasks(project_id)
    
    # Create PDF in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontSize=28,
        spaceAfter=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#C41E3A')  # Weatherford Red
    )
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontSize=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#666666'),
        spaceAfter=6
    )
    heading_style = ParagraphStyle(
        'HeadingStyle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#C41E3A'),  # Weatherford Red
        spaceAfter=12,
        spaceBefore=20
    )
    
    elements = []
    
    # === TITLE PAGE ===
    elements.append(Spacer(1, 2*inch))
    elements.append(Paragraph("CSMS PROJECT REPORT", title_style))
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(f"<b>{project['name']}</b>", ParagraphStyle(
        'ProjectName', fontSize=22, alignment=TA_CENTER, textColor=colors.black, spaceAfter=8
    )))
    
    # Well name prominently displayed below project name
    if project.get('well'):
        elements.append(Paragraph(f"Well: {project['well']}", ParagraphStyle(
            'WellName', fontSize=16, alignment=TA_CENTER, textColor=colors.HexColor('#C41E3A'), spaceAfter=16
        )))
    
    if project.get('title'):
        elements.append(Paragraph(project['title'], subtitle_style))
    
    elements.append(Spacer(1, 0.3*inch))
    
    # Project info table
    info_data = []
    if project.get('well'):
        info_data.append(['Well:', project['well']])
    if project.get('kontrak_no'):
        info_data.append(['Kontrak No:', project['kontrak_no']])
    if project.get('status'):
        info_data.append(['Status:', project['status']])
    if project.get('start_date'):
        info_data.append(['Start Date:', project['start_date']])
    if project.get('end_date'):
        info_data.append(['End Date:', project['end_date']])
    if project.get('rig_down'):
        info_data.append(['Rig Down:', project['rig_down']])
    if project.get('assigned_to'):
        info_data.append(['Assigned To:', project['assigned_to']])
    
    info_data.append(['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M')])
    
    if info_data:
        info_table = Table(info_data, colWidths=[1.5*inch, 3*inch])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(info_table)
    
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph("Weatherford CSMS Project Management System", subtitle_style))
    
    # === TASKS AND ATTACHMENTS PAGE ===
    elements.append(PageBreak())
    elements.append(Paragraph("Task Summary & Attachments", heading_style))
    
    # Task statistics
    completed = len([t for t in tasks if t.get('status') == 'Completed'])
    total_attachments = sum(len(t.get('attachments', [])) for t in tasks)
    
    stats_data = [
        ['Total Tasks:', str(len(tasks))],
        ['Completed:', f"{completed} ({(completed/max(len(tasks),1)*100):.0f}%)"],
        ['Total Attachments:', str(total_attachments)]
    ]
    stats_table = Table(stats_data, colWidths=[1.5*inch, 2*inch])
    stats_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f5f5')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#ddd')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # List each task with attachments
    attachment_index = 0
    for task in tasks:
        task_code = task.get('code', '')
        task_title = task.get('title', 'Untitled')
        task_status = task.get('status', 'Upcoming')
        attachments = task.get('attachments', [])
        
        status_color = colors.HexColor('#46D369') if task_status == 'Completed' else colors.HexColor('#F5A623') if task_status == 'In Progress' else colors.HexColor('#666666')
        
        # Task header
        task_header = f"<b>{task_code}</b> - {task_title}"
        elements.append(Paragraph(task_header, ParagraphStyle(
            'TaskHeader', fontSize=11, textColor=colors.black, spaceBefore=12, spaceAfter=4
        )))
        elements.append(Paragraph(f"Status: <font color='#{status_color.hexval()[2:]}'>{task_status}</font>", ParagraphStyle(
            'TaskStatus', fontSize=9, textColor=colors.HexColor('#888888')
        )))
        
        # Process attachments - each on its own page with border
        if attachments:
            for att in attachments:
                attachment_index += 1
                filename = att.get('filename', 'Unknown')
                uploaded = att.get('uploaded_at', '')[:10] if att.get('uploaded_at') else ''
                file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
                
                # Page break for each attachment
                elements.append(PageBreak())
                
                # Attachment header with border box
                header_table = Table(
                    [[f"Attachment {attachment_index}: {filename}", f"Uploaded: {uploaded}"]],
                    colWidths=[4.5*inch, 2*inch]
                )
                header_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E50914')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                    ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 11),
                    ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                    ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ]))
                elements.append(header_table)
                elements.append(Spacer(1, 0.1*inch))
                
                try:
                    # Find file in Google Drive
                    file_id = drive_service.find_file_in_folder(filename, project['name'])
                    if not file_id:
                        elements.append(Paragraph("<i>[File not found in Google Drive]</i>", ParagraphStyle(
                            'FileError', fontSize=10, textColor=colors.HexColor('#999999'), alignment=TA_CENTER, spaceBefore=50
                        )))
                        continue
                    
                    # Download file
                    file_data = drive_service.download_file(file_id)
                    if not file_data:
                        elements.append(Paragraph("<i>[Could not download file]</i>", ParagraphStyle(
                            'FileError', fontSize=10, textColor=colors.HexColor('#999999'), alignment=TA_CENTER, spaceBefore=50
                        )))
                        continue
                    
                    # Process based on file type
                    if file_ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp']:
                        # Direct image embedding with border
                        img_buffer = io.BytesIO(file_data)
                        pil_img = PILImage.open(img_buffer)
                        
                        max_width = 6 * inch
                        max_height = 7.5 * inch
                        img_width, img_height = pil_img.size
                        scale = min(max_width / img_width, max_height / img_height, 1)
                        final_width = img_width * scale
                        final_height = img_height * scale
                        
                        img_buffer.seek(0)
                        rl_img = RLImage(img_buffer, width=final_width, height=final_height)
                        
                        # Wrap in table for border
                        img_table = Table([[rl_img]], colWidths=[final_width + 10])
                        img_table.setStyle(TableStyle([
                            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#333333')),
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('TOPPADDING', (0, 0), (-1, -1), 5),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                        ]))
                        elements.append(img_table)
                        
                    elif file_ext == 'pdf':
                        # PDF - render pages with PyMuPDF
                        try:
                            import fitz
                            pdf_doc = fitz.open(stream=file_data, filetype='pdf')
                            total_pages = len(pdf_doc)
                            max_pages = min(20, total_pages)
                            
                            for page_num in range(max_pages):
                                if page_num > 0:
                                    elements.append(PageBreak())
                                    # Page continuation header
                                    cont_header = Table(
                                        [[f"{filename} - Page {page_num + 1} of {total_pages}"]],
                                        colWidths=[6.5*inch]
                                    )
                                    cont_header.setStyle(TableStyle([
                                        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#444444')),
                                        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                                        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                                        ('FONTSIZE', (0, 0), (-1, -1), 10),
                                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                                    ]))
                                    elements.append(cont_header)
                                    elements.append(Spacer(1, 0.1*inch))
                                
                                page = pdf_doc[page_num]
                                mat = fitz.Matrix(2, 2)  # 144 DPI for good quality
                                pix = page.get_pixmap(matrix=mat)
                                
                                img_data = pix.tobytes("png")
                                img_buffer = io.BytesIO(img_data)
                                pil_img = PILImage.open(img_buffer)
                                
                                max_width = 6.2 * inch
                                max_height = 8 * inch
                                img_width, img_height = pil_img.size
                                scale = min(max_width / img_width, max_height / img_height, 1)
                                final_width = img_width * scale
                                final_height = img_height * scale
                                
                                img_buffer.seek(0)
                                rl_img = RLImage(img_buffer, width=final_width, height=final_height)
                                
                                # Wrap in bordered table
                                img_table = Table([[rl_img]], colWidths=[final_width + 6])
                                img_table.setStyle(TableStyle([
                                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#333333')),
                                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                                ]))
                                elements.append(img_table)
                            
                            pdf_doc.close()
                            
                            if total_pages > max_pages:
                                elements.append(Paragraph(f"<i>[Showing first {max_pages} of {total_pages} pages]</i>", ParagraphStyle(
                                    'PageNote', fontSize=9, textColor=colors.HexColor('#888888'), alignment=TA_CENTER, spaceBefore=10
                                )))
                                
                        except Exception as e:
                            print(f"[WARN] PyMuPDF PDF error {filename}: {e}")
                            elements.append(Paragraph(f"<i>[PDF preview not available]</i>", ParagraphStyle(
                                'FileNote', fontSize=10, textColor=colors.HexColor('#666666'), alignment=TA_CENTER, spaceBefore=50
                            )))
                    
                    elif file_ext in ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt']:
                        # Office files - convert to PDF using Google Drive, then render
                        try:
                            import fitz
                            
                            # Convert Office file to PDF via Google Drive
                            pdf_data = drive_service.convert_office_to_pdf(file_id, filename)
                            
                            if pdf_data:
                                # Render the converted PDF
                                pdf_doc = fitz.open(stream=pdf_data, filetype='pdf')
                                total_pages = len(pdf_doc)
                                max_pages = min(20, total_pages)
                                
                                for page_num in range(max_pages):
                                    if page_num > 0:
                                        elements.append(PageBreak())
                                        # Page continuation header
                                        cont_header = Table(
                                            [[f"{filename} - Page {page_num + 1} of {total_pages}"]],
                                            colWidths=[6.5*inch]
                                        )
                                        cont_header.setStyle(TableStyle([
                                            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#444444')),
                                            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                                            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                                            ('FONTSIZE', (0, 0), (-1, -1), 10),
                                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                            ('TOPPADDING', (0, 0), (-1, -1), 6),
                                            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                                        ]))
                                        elements.append(cont_header)
                                        elements.append(Spacer(1, 0.1*inch))
                                    
                                    page = pdf_doc[page_num]
                                    mat = fitz.Matrix(2, 2)  # 144 DPI
                                    pix = page.get_pixmap(matrix=mat)
                                    
                                    img_data = pix.tobytes("png")
                                    img_buffer = io.BytesIO(img_data)
                                    pil_img = PILImage.open(img_buffer)
                                    
                                    max_width = 6.2 * inch
                                    max_height = 8 * inch
                                    img_width, img_height = pil_img.size
                                    scale = min(max_width / img_width, max_height / img_height, 1)
                                    final_width = img_width * scale
                                    final_height = img_height * scale
                                    
                                    img_buffer.seek(0)
                                    rl_img = RLImage(img_buffer, width=final_width, height=final_height)
                                    
                                    # Wrap in bordered table
                                    img_table = Table([[rl_img]], colWidths=[final_width + 6])
                                    img_table.setStyle(TableStyle([
                                        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#333333')),
                                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                        ('TOPPADDING', (0, 0), (-1, -1), 3),
                                        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                                    ]))
                                    elements.append(img_table)
                                
                                pdf_doc.close()
                                
                                if total_pages > max_pages:
                                    elements.append(Paragraph(f"<i>[Showing first {max_pages} of {total_pages} pages]</i>", ParagraphStyle(
                                        'PageNote', fontSize=9, textColor=colors.HexColor('#888888'), alignment=TA_CENTER, spaceBefore=10
                                    )))
                            else:
                                # Conversion failed - show placeholder
                                elements.append(Paragraph(f"<i>[Could not convert {file_ext.upper()} file - stored in Google Drive]</i>", ParagraphStyle(
                                    'FileNote', fontSize=10, textColor=colors.HexColor('#666666'), alignment=TA_CENTER, spaceBefore=50
                                )))
                                
                        except Exception as e:
                            print(f"[WARN] Office conversion error {filename}: {e}")
                            elements.append(Paragraph(f"<i>[Document conversion failed]</i>", ParagraphStyle(
                                'FileNote', fontSize=10, textColor=colors.HexColor('#666666'), alignment=TA_CENTER, spaceBefore=50
                            )))
                    else:
                        # Unknown file type
                        elements.append(Paragraph(f"<i>[File type {file_ext.upper()} - stored in Google Drive]</i>", ParagraphStyle(
                            'FileNote', fontSize=10, textColor=colors.HexColor('#666666'), alignment=TA_CENTER, spaceBefore=50
                        )))
                        
                except Exception as e:
                    print(f"[WARN] Could not process attachment {filename}: {e}")
                    elements.append(Paragraph(f"<i>[Error processing file]</i>", ParagraphStyle(
                        'FileError', fontSize=10, textColor=colors.HexColor('#999999'), alignment=TA_CENTER, spaceBefore=50
                    )))
        else:
            elements.append(Paragraph("<i>No attachments for this task</i>", ParagraphStyle(
                'NoAttachment', fontSize=10, textColor=colors.HexColor('#999999'), leftIndent=20
            )))
    
    # === FOOTER ===
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(
        "<i>Generated by CSMS Project Management System - Weatherford</i>",
        ParagraphStyle('FootNote', fontSize=9, textColor=colors.HexColor('#888888'), alignment=TA_CENTER)
    ))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"{project['name'].replace(' ', '_')}_Report.pdf"
    
    # Return based on mode
    disposition = "inline" if mode == "preview" else "attachment"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"{disposition}; filename={filename}"}
    )

# --- Tasks ---

@app.get("/tasks")
def list_tasks(status: Optional[str] = None):
    # This is for the "All Tasks" gallery, possibly filtered
    all_tasks = db.get_tasks()
    if status:
        return [t for t in all_tasks if t.get('status') == status]
    return all_tasks

@app.put("/tasks/{task_id}")
def update_task(task_id: str, task_update: dict):
    updated = db.update_task(task_id, task_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated

@app.post("/tasks/{task_id}/upload")
async def upload_attachment(
    task_id: str, 
    file: UploadFile = File(...)
):
    # 1. Get Task & Project info
    tasks = db.get_tasks()
    task = next((t for t in tasks if t['id'] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    project = db.get_project(task['project_id'])
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Read file content
    content = await file.read()
    
    # 3. Upload to Drive
    success = await drive_service.upload_file_to_drive(
        file_data=content, 
        filename=file.filename, 
        project_name=project['name']
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to upload to Drive")
        
    # 4. Update Task with attachment info
    current_attachments = task.get("attachments", [])
    current_attachments.append({
        "filename": file.filename,
        "uploaded_at": datetime.now().isoformat()
    })
    db.update_task(task_id, {"attachments": current_attachments})
    
    return {"status": "success", "filename": file.filename}

# --- Schedules ---

@app.get("/schedules")
def list_schedules():
    return get_schedules()

@app.post("/schedules")
def create_schedule(schedule: ScheduleCreate, background_tasks: BackgroundTasks):
    import uuid
    
    # Create schedule
    new_schedule = {
        "id": str(uuid.uuid4()),
        **schedule.dict(),
        "created_at": datetime.now().isoformat()
    }
    
    # Save to file
    schedules = get_schedules()
    schedules.append(new_schedule)
    save_schedules(schedules)
    
    # Send email notification in background
    background_tasks.add_task(send_schedule_email, new_schedule)
    
    return new_schedule

# --- Rig Down Reminder System ---

def send_rig_down_reminder(project: dict, completion_percentage: float, incomplete_tasks: list):
    """Send reminder email for rig down deadline"""
    from dotenv import load_dotenv
    load_dotenv()
    
    try:
        smtp_email = os.getenv('SMTP_EMAIL')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not smtp_email or not smtp_password or not project.get('pic_email'):
            print(f"[REMINDER] Missing credentials or PIC email for {project['name']}")
            return False
        
        recipient = project['pic_email']
        subject = f"⚠️ URGENT: Rig Down Deadline Approaching - {project['name']}"
        
        task_list = "".join([f"<li>{t['code']}: {t['title']}</li>" for t in incomplete_tasks[:10]])
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="background: #FF6B35; color: white; padding: 20px; border-radius: 8px;">
                <h2 style="margin: 0;">⚠️ Rig Down Deadline Reminder</h2>
            </div>
            <div style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin-top: 10px;">
                <p>Dear PIC,</p>
                <p><strong>Rig Down Date:</strong> {project.get('rig_down', 'N/A')}</p>
                <p><strong>Project:</strong> {project['name']}</p>
                <p><strong>Well:</strong> {project.get('well', 'N/A')}</p>
                
                <div style="background: #E50914; color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0;">Task Completion: {completion_percentage:.1f}%</h3>
                    <p style="margin: 5px 0 0 0;">Required: 95% - Current: {completion_percentage:.1f}%</p>
                </div>
                
                <p><strong>Incomplete Tasks ({len(incomplete_tasks)}):</strong></p>
                <ul>{task_list}</ul>
                {f"<p><em>...and {len(incomplete_tasks) - 10} more</em></p>" if len(incomplete_tasks) > 10 else ""}
                
                <p style="color: #E50914; font-weight: bold;">Please complete the remaining tasks before the Rig Down date.</p>
                
                <p>Best regards,<br><strong>CSMS Project Management System</strong><br>Weatherford</p>
            </div>
        </body>
        </html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['From'] = smtp_email
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)
        server.quit()
        
        print(f"[REMINDER] Sent to {recipient} for project {project['name']}")
        return True
        
    except Exception as e:
        print(f"[REMINDER ERROR] {e}")
        return False

@app.get("/check-reminders")
def check_and_send_reminders(background_tasks: BackgroundTasks):
    """Check projects approaching rig down and send reminders if tasks < 95% complete"""
    today = datetime.now().date()
    reminders_sent = []
    
    projects = db.get_projects()
    all_tasks = db.get_tasks()
    
    for project in projects:
        rig_down = project.get('rig_down')
        if not rig_down or not project.get('pic_email'):
            continue
        
        try:
            rig_down_date = datetime.strptime(rig_down, '%Y-%m-%d').date()
            days_until = (rig_down_date - today).days
            
            # Check if 2 days before rig down
            if days_until <= 2 and days_until >= 0:
                # Get project tasks
                project_tasks = [t for t in all_tasks if t.get('project_id') == project['id']]
                
                if len(project_tasks) == 0:
                    continue
                
                completed = len([t for t in project_tasks if t.get('status') == 'Completed'])
                completion_pct = (completed / len(project_tasks)) * 100
                
                # Send reminder if less than 95% complete
                if completion_pct < 95:
                    incomplete = [t for t in project_tasks if t.get('status') != 'Completed']
                    background_tasks.add_task(send_rig_down_reminder, project, completion_pct, incomplete)
                    reminders_sent.append({
                        "project": project['name'],
                        "rig_down": rig_down,
                        "completion": completion_pct,
                        "pic_email": project['pic_email']
                    })
        except Exception as e:
            print(f"[REMINDER] Error checking project {project['name']}: {e}")
    
    return {"reminders_sent": len(reminders_sent), "details": reminders_sent}

# --- Statistics API ---

@app.get("/statistics")
def get_statistics():
    """Get comprehensive statistics for dashboard"""
    projects = db.get_projects()
    tasks = db.get_tasks()
    schedules = get_schedules()
    
    # Project stats
    project_stats = {
        "total": len(projects),
        "by_status": {
            "Upcoming": len([p for p in projects if p.get('status') == 'Upcoming']),
            "InProgress": len([p for p in projects if p.get('status') in ['InProgress', 'Ongoing']]),
            "Completed": len([p for p in projects if p.get('status') == 'Completed']),
            "OnHold": len([p for p in projects if p.get('status') == 'OnHold'])
        }
    }
    
    # Task stats
    task_stats = {
        "total": len(tasks),
        "by_status": {
            "Upcoming": len([t for t in tasks if t.get('status') == 'Upcoming']),
            "In Progress": len([t for t in tasks if t.get('status') == 'In Progress']),
            "Completed": len([t for t in tasks if t.get('status') == 'Completed'])
        },
        "completion_rate": (len([t for t in tasks if t.get('status') == 'Completed']) / max(len(tasks), 1)) * 100,
        "with_attachments": len([t for t in tasks if t.get('attachments') and len(t['attachments']) > 0])
    }
    
    # Schedule stats
    today = datetime.now().date()
    upcoming_mwt = [s for s in schedules if datetime.strptime(s['mwt_plan_date'], '%Y-%m-%d').date() >= today]
    upcoming_hse = [s for s in schedules if datetime.strptime(s['hse_meeting_date'], '%Y-%m-%d').date() >= today]
    
    schedule_stats = {
        "total": len(schedules),
        "upcoming_mwt": len(upcoming_mwt),
        "upcoming_hse": len(upcoming_hse),
        "this_month": len([s for s in schedules if datetime.strptime(s['mwt_plan_date'], '%Y-%m-%d').date().month == today.month])
    }
    
    # Project completion breakdown by project
    project_completion = []
    for p in projects[:10]:  # Top 10
        proj_tasks = [t for t in tasks if t.get('project_id') == p['id']]
        completed = len([t for t in proj_tasks if t.get('status') == 'Completed'])
        total = len(proj_tasks)
        project_completion.append({
            "name": p['name'][:20],
            "completed": completed,
            "total": total,
            "percentage": (completed / max(total, 1)) * 100
        })
    
    return {
        "projects": project_stats,
        "tasks": task_stats,
        "schedules": schedule_stats,
        "project_completion": project_completion
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
