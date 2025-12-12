import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getTasks } from '../services/api';
import { COLORS } from '../App';

const STATUS_FILTERS = ['All', 'Upcoming', 'In Progress', 'Completed', 'Overdue'];

export default function TasksScreen() {
    const navigation = useNavigation();
    const [tasks, setTasks] = useState([]);
    const [filter, setFilter] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    const fetchTasks = async () => {
        try {
            const res = await getTasks();
            setTasks(res.data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchTasks();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTasks();
        setRefreshing(false);
    };

    const filteredTasks = filter === 'All'
        ? tasks
        : tasks.filter(t => t.status === filter);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Upcoming': return COLORS.warning;
            case 'In Progress': return COLORS.success;
            case 'Completed': return '#4A90D9';
            case 'Overdue': return COLORS.error;
            default: return COLORS.textSecondary;
        }
    };

    const renderTask = ({ item }) => (
        <TouchableOpacity
            style={styles.taskCard}
            onPress={() => navigation.navigate('TaskForm', { taskId: item.id })}
        >
            <View style={styles.taskHeader}>
                <Text style={styles.taskCode}>{item.code}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.taskCategory}>{item.category}</Text>
            {item.attachments && item.attachments.length > 0 && (
                <Text style={styles.attachmentInfo}>📎 {item.attachments.length} attachment(s)</Text>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Filter Tabs - Scrollable */}
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={STATUS_FILTERS}
                keyExtractor={item => item}
                style={styles.filterList}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item: f }) => (
                    <TouchableOpacity
                        style={[styles.filterTab, filter === f && styles.filterTabActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                )}
            />

            {/* Task List */}
            <FlatList
                data={filteredTasks}
                renderItem={renderTask}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No tasks found</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    filterList: {
        maxHeight: 60,
        backgroundColor: COLORS.card,
    },
    filterRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: COLORS.background,
    },
    filterTabActive: {
        backgroundColor: COLORS.primary,
    },
    filterText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    filterTextActive: {
        color: COLORS.text,
        fontWeight: 'bold',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: 20,
    },
    taskCard: {
        backgroundColor: COLORS.card,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    taskCode: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: 'bold',
    },
    taskTitle: {
        fontSize: 16,
        color: COLORS.text,
        marginBottom: 4,
    },
    taskCategory: {
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    attachmentInfo: {
        color: COLORS.success,
        fontSize: 12,
        marginTop: 8,
    },
    emptyText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});
