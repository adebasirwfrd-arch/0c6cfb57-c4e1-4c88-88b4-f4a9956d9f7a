import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProjects, getTasks } from '../services/api';
import { COLORS } from '../App';

export default function HomeScreen() {
    const [stats, setStats] = useState({
        totalProjects: 0,
        ongoingProjects: 0,
        totalTasks: 0,
        upcomingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
    });
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const [projectsRes, tasksRes] = await Promise.all([getProjects(), getTasks()]);
            const projects = projectsRes.data;
            const tasks = tasksRes.data;

            setStats({
                totalProjects: projects.length,
                ongoingProjects: projects.filter(p => p.status === 'Ongoing').length,
                totalTasks: tasks.length,
                upcomingTasks: tasks.filter(t => t.status === 'Upcoming').length,
                inProgressTasks: tasks.filter(t => t.status === 'In Progress').length,
                overdueTasks: tasks.filter(t => t.status === 'Overdue').length,
            });
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const StatCard = ({ title, value, color }) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
            <Text style={styles.header}>CSMS Dashboard</Text>

            <Text style={styles.sectionTitle}>Projects</Text>
            <View style={styles.statsRow}>
                <StatCard title="Total" value={stats.totalProjects} color={COLORS.primary} />
                <StatCard title="Ongoing" value={stats.ongoingProjects} color={COLORS.success} />
            </View>

            <Text style={styles.sectionTitle}>Tasks</Text>
            <View style={styles.statsRow}>
                <StatCard title="Upcoming" value={stats.upcomingTasks} color={COLORS.warning} />
                <StatCard title="In Progress" value={stats.inProgressTasks} color={COLORS.success} />
                <StatCard title="Overdue" value={stats.overdueTasks} color={COLORS.error} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: 16,
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        color: COLORS.textSecondary,
        marginBottom: 12,
        marginTop: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    statCard: {
        backgroundColor: COLORS.card,
        borderRadius: 8,
        padding: 16,
        minWidth: '48%',
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    statValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    statTitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
});
