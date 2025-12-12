import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getProjectDetails } from '../services/api';
import { COLORS } from '../App';

export default function ProjectDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { projectId } = route.params;

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await getProjectDetails(projectId);
                setProject(res.data.project);
                setTasks(res.data.tasks);
            } catch (error) {
                console.error('Error fetching project details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [projectId]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Upcoming': return COLORS.warning;
            case 'In Progress': return COLORS.success;
            case 'Completed': return '#4A90D9';
            case 'Overdue': return COLORS.error;
            default: return COLORS.textSecondary;
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!project) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Project not found</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Project Info Card */}
            <View style={styles.infoCard}>
                <Text style={styles.projectName}>{project.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) }]}>
                    <Text style={styles.statusText}>{project.status}</Text>
                </View>
                <Text style={styles.description}>{project.description || 'No description provided.'}</Text>
                <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>Start: {project.start_date || 'N/A'}</Text>
                    <Text style={styles.dateLabel}>End: {project.end_date || 'N/A'}</Text>
                </View>
            </View>

            {/* Tasks Section */}
            <Text style={styles.sectionTitle}>Tasks ({tasks.length})</Text>

            {tasks.map(task => (
                <TouchableOpacity
                    key={task.id}
                    style={styles.taskCard}
                    onPress={() => navigation.navigate('TaskForm', { taskId: task.id })}
                >
                    <View style={styles.taskHeader}>
                        <Text style={styles.taskCode}>{task.code}</Text>
                        <View style={[styles.taskStatusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                            <Text style={styles.taskStatusText}>{task.status}</Text>
                        </View>
                    </View>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.attachments && task.attachments.length > 0 && (
                        <Text style={styles.attachmentInfo}>📎 {task.attachments.length} file(s)</Text>
                    )}
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 16,
    },
    infoCard: {
        backgroundColor: COLORS.card,
        margin: 16,
        padding: 20,
        borderRadius: 12,
    },
    projectName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 12,
    },
    statusText: {
        color: COLORS.text,
        fontWeight: 'bold',
        fontSize: 14,
    },
    description: {
        color: COLORS.textSecondary,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateLabel: {
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 12,
    },
    taskCard: {
        backgroundColor: COLORS.card,
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 14,
        borderRadius: 8,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    taskCode: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: 13,
    },
    taskStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    taskStatusText: {
        color: COLORS.text,
        fontSize: 11,
        fontWeight: 'bold',
    },
    taskTitle: {
        color: COLORS.text,
        fontSize: 15,
    },
    attachmentInfo: {
        color: COLORS.success,
        fontSize: 12,
        marginTop: 6,
    },
});
