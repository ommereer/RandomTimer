import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  AppState,
  Switch,
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Define the background task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    // Task will handle notification scheduling
  }
});

// Frequency presets: pings per hour
const FREQUENCY_PRESETS = [
  { value: 0.125, label: '1 ping / 8 hours' },
  { value: 0.25, label: '1 ping / 4 hours' },
  { value: 0.5, label: '1 ping / 2 hours' },
  { value: 1, label: '1 ping / hour' },
  { value: 2, label: '2 pings / hour' },
  { value: 4, label: '4 pings / hour' },
  { value: 6, label: '6 pings / hour' },
  { value: 12, label: '12 pings / hour' },
  { value: 20, label: '20 pings / hour' },
  { value: 30, label: '30 pings / hour' },
  { value: 60, label: '60 pings / hour' },
];

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [avgBeepsPerHour, setAvgBeepsPerHour] = useState(12);
  const [nextBeepIn, setNextBeepIn] = useState(0);
  const [totalBeeps, setTotalBeeps] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Time window settings
  const [useTimeWindow, setUseTimeWindow] = useState(true);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(21);
  const [endMinute, setEndMinute] = useState(0);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const intervalRef = useRef(null);
  const soundRef = useRef(null);
  const notificationListener = useRef();
  const appState = useRef(AppState.currentState);
  const nextBeepTimeRef = useRef(0);
  const notificationIdRef = useRef(null);
  const foregroundServiceStarted = useRef(false);

  useEffect(() => {
    setupAudio();
    requestPermissions();

    notificationListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      if (notification.request.content.data?.type === 'beep') {
        playBeepSound();
        scheduleNextBeep();
      }
    });

    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      if (nextAppState === 'active' && nextBeepTimeRef.current > 0) {
        startCountdownUpdates();
      } else {
        stopCountdownUpdates();
      }
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      subscription.remove();
    };
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
      });
    } catch (error) {
      console.log('Error setting audio mode:', error);
    }
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Notification permission is required for background operation.');
    }
  };

  const startForegroundService = async () => {
    if (foregroundServiceStarted.current) return;

    try {
      // Create persistent notification for foreground service
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Random Timer Active',
          body: '',
          data: { type: 'foreground' },
          sticky: true,
          priority: Notifications.AndroidNotificationPriority.LOW,
        },
        trigger: null,
      });
      foregroundServiceStarted.current = true;
    } catch (error) {
      console.log('Error starting foreground service:', error);
    }
  };

  const stopForegroundService = async () => {
    if (!foregroundServiceStarted.current) return;

    try {
      await Notifications.dismissAllNotificationsAsync();
      foregroundServiceStarted.current = false;
    } catch (error) {
      console.log('Error stopping foreground service:', error);
    }
  };

  const isWithinTimeWindow = () => {
    if (!useTimeWindow) return true;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  };

  const getRandomInterval = () => {
    const avgIntervalMs = (60 * 60 * 1000) / avgBeepsPerHour;
    const minInterval = avgIntervalMs * 0.5;
    const maxInterval = avgIntervalMs * 1.5;
    return Math.random() * (maxInterval - minInterval) + minInterval;
  };

  const playBeepSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/beep.mp3'),
        { shouldPlay: true, volume: 0.9, isLooping: false }
      );

      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });

      setTotalBeeps(prev => prev + 1);
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const startCountdownUpdates = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (appState.current === 'active' && nextBeepTimeRef.current > 0) {
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((nextBeepTimeRef.current - Date.now()) / 1000));
        setNextBeepIn(remaining);
        if (remaining === 0) clearInterval(intervalRef.current);
      }, 1000);
    }
  };

  const stopCountdownUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const scheduleNextBeep = async () => {
    if (!isActive) return;

    try {
      if (notificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      }

      const intervalMs = getRandomInterval();
      const intervalSeconds = Math.floor(intervalMs / 1000);
      nextBeepTimeRef.current = Date.now() + intervalMs;

      if (!isWithinTimeWindow()) {
        const checkInterval = 60;
        nextBeepTimeRef.current = Date.now() + (checkInterval * 1000);

        notificationIdRef.current = await Notifications.scheduleNotificationAsync({
          content: {
            title: '',
            body: '',
            sound: 'beep.mp3',
            data: { type: 'beep' },
          },
          trigger: { seconds: checkInterval },
        });

        if (appState.current === 'active') startCountdownUpdates();
        return;
      }

      notificationIdRef.current = await Notifications.scheduleNotificationAsync({
        content: {
          title: '',
          body: '',
          sound: 'beep.mp3',
          data: { type: 'beep' },
        },
        trigger: { seconds: intervalSeconds },
      });

      if (appState.current === 'active') startCountdownUpdates();
    } catch (error) {
      console.log('Error scheduling notification:', error);
      setTimeout(() => scheduleNextBeep(), 5000);
    }
  };

  useEffect(() => {
    if (isActive) {
      startForegroundService();
      scheduleNextBeep();
    } else {
      if (notificationIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      }
      stopForegroundService();
      stopCountdownUpdates();
      setNextBeepIn(0);
      nextBeepTimeRef.current = 0;
    }

    return () => {
      stopCountdownUpdates();
    };
  }, [isActive, avgBeepsPerHour]);

  const toggleActive = () => {
    setIsActive(!isActive);
    if (isActive) {
      setTotalBeeps(0);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeDisplay = (hour, minute) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const getIntervalDescription = (beepsPerHour) => {
    const preset = FREQUENCY_PRESETS.find(p => p.value === beepsPerHour);
    if (preset) return preset.label;
    const hours = 1 / beepsPerHour;
    if (hours >= 1) {
      return `1 ping / ${Math.round(hours)} hours`;
    }
    const mins = 60 / beepsPerHour;
    return `1 ping / ${Math.round(mins)} min`;
  };

  const selectNextFrequency = () => {
    if (isActive) return;
    const currentIndex = FREQUENCY_PRESETS.findIndex(p => p.value === avgBeepsPerHour);
    const nextIndex = (currentIndex + 1) % FREQUENCY_PRESETS.length;
    setAvgBeepsPerHour(FREQUENCY_PRESETS[nextIndex].value);
  };

  const selectPrevFrequency = () => {
    if (isActive) return;
    const currentIndex = FREQUENCY_PRESETS.findIndex(p => p.value === avgBeepsPerHour);
    const prevIndex = currentIndex === 0 ? FREQUENCY_PRESETS.length - 1 : currentIndex - 1;
    setAvgBeepsPerHour(FREQUENCY_PRESETS[prevIndex].value);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Random Ping Timer</Text>
          <TouchableOpacity onPress={() => setShowHelp(true)} style={styles.helpButton}>
            <Text style={styles.helpButtonText}>?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.powerSection}>
          <TouchableOpacity
            style={[styles.powerButton, isActive ? styles.powerButtonActive : styles.powerButtonInactive]}
            onPress={toggleActive}
            activeOpacity={0.8}
          >
            <Text style={styles.powerIcon}>{isActive ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <Text style={styles.statusText}>{isActive ? 'Active' : 'Inactive'}</Text>

          {isActive && (
            <View style={styles.countdownSection}>
              <Text style={styles.countdownLabel}>Next ping in:</Text>
              <Text style={styles.countdownTime}>{formatTime(nextBeepIn)}</Text>
              <Text style={styles.beepCount}>Total: {totalBeeps}</Text>
            </View>
          )}
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Frequency</Text>
            <View style={styles.frequencySelector}>
              <TouchableOpacity
                style={[styles.freqButton, isActive && styles.freqButtonDisabled]}
                onPress={selectPrevFrequency}
                disabled={isActive}
              >
                <Text style={styles.freqButtonText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.frequencyText}>{getIntervalDescription(avgBeepsPerHour)}</Text>
              <TouchableOpacity
                style={[styles.freqButton, isActive && styles.freqButtonDisabled]}
                onPress={selectNextFrequency}
                disabled={isActive}
              >
                <Text style={styles.freqButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Time Window</Text>
              <Switch
                value={useTimeWindow}
                onValueChange={setUseTimeWindow}
                disabled={isActive}
                trackColor={{ false: '#475569', true: '#10b981' }}
                thumbColor={useTimeWindow ? '#ffffff' : '#cbd5e1'}
              />
            </View>

            {useTimeWindow && (
              <View style={styles.timeWindowContainer}>
                <View style={styles.timePickerRow}>
                  <Text style={styles.timeLabel}>Start:</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowStartPicker(true)}
                    disabled={isActive}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatTimeDisplay(startHour, startMinute)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.timePickerRow}>
                  <Text style={styles.timeLabel}>End:</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowEndPicker(true)}
                    disabled={isActive}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatTimeDisplay(endHour, endMinute)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, startHour, startMinute)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={(event, selectedDate) => {
                setShowStartPicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setStartHour(selectedDate.getHours());
                  setStartMinute(selectedDate.getMinutes());
                }
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, endHour, endMinute)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={(event, selectedDate) => {
                setShowEndPicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setEndHour(selectedDate.getHours());
                  setEndMinute(selectedDate.getMinutes());
                }
              }}
            />
          )}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.testButton} onPress={() => playBeepSound()} activeOpacity={0.8}>
            <Text style={styles.testButtonText}>Test Ping</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Help Modal */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How It Works</Text>

            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>Random Pings</Text>{'\n'}
              Pings sound at random intervals around your chosen frequency.{'\n\n'}

              <Text style={styles.helpBold}>Frequency</Text>{'\n'}
              Choose how often pings occur (from once per 8 hours to 60 times per hour).{'\n\n'}

              <Text style={styles.helpBold}>Time Window</Text>{'\n'}
              Enable to restrict pings to certain hours. Disable for 24/7 operation.{'\n\n'}

              <Text style={styles.helpBold}>Background Operation</Text>{'\n'}
              Works in background and when screen is locked. Plays over other audio without pausing it.{'\n\n'}

              <Text style={styles.helpBold}>Battery</Text>{'\n'}
              Uses foreground service for reliable operation with minimal battery impact.
            </Text>

            <TouchableOpacity style={styles.modalButton} onPress={() => setShowHelp(false)}>
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  helpButton: {
    position: 'absolute',
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  powerSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  powerButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  powerButtonActive: {
    backgroundColor: '#10b981',
  },
  powerButtonInactive: {
    backgroundColor: '#475569',
  },
  powerIcon: {
    fontSize: 40,
    color: '#ffffff',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
  },
  countdownSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  countdownTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  beepCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },
  settingsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  settingItem: {
    marginBottom: 8,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
  },
  frequencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freqButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  freqButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  freqButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  frequencyText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  timeWindowContainer: {
    marginTop: 8,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeLabel: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  timeButton: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  testButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 20,
  },
  helpBold: {
    fontWeight: '700',
    color: '#10b981',
  },
  modalButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
