/**
 * Profile View Screen
 * @remarks
 * Displays user profile information with option to edit
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import { getUserProfile } from '@/services/userService';
import { User } from '@/types/user';

/**
 * Profile View Screen Component
 * @component
 */
export default function ProfileScreen() {
  const router = useRouter();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view your profile.');
        return;
      }

      try {
        const userProfile = await getUserProfile(currentUser.uid);
        setProfile(userProfile);
      } catch (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [currentUser]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Profile"
        rightAction={{
          icon: 'create-outline',
          onPress: () => router.push('/profile/edit'),
        }}
      />

      <View style={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.profilePhoto} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>
                {profile.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>@{profile.username}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Display Name</Text>
            <Text style={styles.infoValue}>{profile.displayName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/profile/settings')}
          >
            <View style={styles.settingsContent}>
              <Ionicons name="settings-outline" size={24} color="#007AFF" />
              <Text style={styles.settingsText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  infoSection: {
    marginBottom: 32,
  },
  infoRow: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#000000',
  },
  errorText: {
    fontSize: 16,
    color: '#999999',
  },
  settingsSection: {
    marginTop: 24,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  settingsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: 12,
    fontWeight: '500',
  },
});
