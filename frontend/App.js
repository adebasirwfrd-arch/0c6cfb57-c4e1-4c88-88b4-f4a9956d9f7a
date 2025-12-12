import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

// Screens
import HomeScreen from './screens/HomeScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import TasksScreen from './screens/TasksScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import ProjectFormScreen from './screens/ProjectFormScreen';
import TaskFormScreen from './screens/TaskFormScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Theme Colors (Netflix-style)
export const COLORS = {
    primary: '#E50914',
    background: '#141414',
    card: '#1F1F1F',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    success: '#46D369',
    warning: '#F5A623',
    error: '#E50914',
};

function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarStyle: { backgroundColor: COLORS.background, borderTopColor: COLORS.card },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.text,
            }}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
            <Tab.Screen name="Projects" component={ProjectsScreen} options={{ tabBarLabel: 'Projects' }} />
            <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarLabel: 'Tasks' }} />
        </Tab.Navigator>
    );
}

export default function App() {
    return (
        <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
                screenOptions={{
                    headerStyle: { backgroundColor: COLORS.background },
                    headerTintColor: COLORS.text,
                    contentStyle: { backgroundColor: COLORS.background },
                }}
            >
                <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
                <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Project Details' }} />
                <Stack.Screen name="ProjectForm" component={ProjectFormScreen} options={{ title: 'New Project' }} />
                <Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ title: 'Task Details' }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
