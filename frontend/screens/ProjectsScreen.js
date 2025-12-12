import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getProjects } from '../services/api';
import { COLORS } from '../App';

const STATUS_FILTERS = ['All', 'Ongoing', 'Completed', 'Pending'];

export default function ProjectsScreen() {
    const navigation = useNavigation();
    const [projects, setProjects] = useState([]);
    const [filter, setFilter] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    const fetchProjects = async () => {
        try {
            const res = await getProjects();
            setProjects(res.data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProjects();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchProjects();
        setRefreshing(false);
    };

    const filteredProjects = filter === 'All'
        ? projects
        : projects.filter(p => p.status === filter);

    const renderProject = ({ item }) => (
        <TouchableOpacity
            style={styles.projectCard}
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
        >
            <View style={styles.projectHeader}>
                <Text style={styles.projectName}>{item.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
            <Text style={styles.projectDescription} numberOfLines={2}>{item.description || 'No description'}</Text>
            <Text style={styles.projectDate}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
        </TouchableOpacity>
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'Ongoing': return COLORS.success;
            case 'Completed': return COLORS.primary;
            case 'Pending': return COLORS.warning;
            default: return COLORS.textSecondary;
        }
    };

    return (
        <View style={styles.container}>
            {/* Filter Tabs */}
            <View style={styles.filterRow}>
                {STATUS_FILTERS.map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterTab, filter === f && styles.filterTabActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Add Project Button */}
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate('ProjectForm')}
            >
                <Text style={styles.addButtonText}>+ New Project</Text>
            </TouchableOpacity>

            {/* Project List */}
            <FlatList
                data={filteredProjects}
                renderItem={renderProject}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No projects found</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.card,
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
    addButton: {
        backgroundColor: COLORS.primary,
        margin: 16,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonText: {
        color: COLORS.text,
        fontWeight: 'bold',
        fontSize: 16,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    projectCard: {
        backgroundColor: COLORS.card,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    projectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    projectName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        flex: 1,
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
    projectDescription: {
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: 8,
    },
    projectDate: {
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    emptyText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});
