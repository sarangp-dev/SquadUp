import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  /** data: URI of the resized photo (kept small so it fits in local storage) */
  photoUri?: string;
  position?: Position;
}

export interface SavedTeam {
  teamId: string;
  teamName: string;
  playerCount: number;
  players: Player[];
  positions: Record<string, Position>;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Local storage helpers (AsyncStorage = localStorage on web)                */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = '@football_planner_saved_teams';
const PHOTO_WIDTH = 240; // px – photos are shrunk to this before being stored

function isSavedTeam(value: unknown): value is SavedTeam {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<SavedTeam>;
  return (
    typeof t.teamId === 'string' &&
    typeof t.teamName === 'string' &&
    typeof t.createdAt === 'string' &&
    Array.isArray(t.players) &&
    t.players.length >= 3 &&
    t.players.length <= 11
  );
}

/** All saved teams, newest first. Never throws. */
export async function getAllSavedTeams(): Promise<SavedTeam[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedTeam)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.warn('Failed to load saved teams:', error);
    return [];
  }
}

export async function getSavedTeamById(teamId: string): Promise<SavedTeam | null> {
  const teams = await getAllSavedTeams();
  return teams.find((t) => t.teamId === teamId) ?? null;
}

/** Creates the team or replaces the one with the same teamId. Throws if storage fails. */
export async function saveTeamToStorage(team: SavedTeam): Promise<void> {
  const teams = await getAllSavedTeams();
  const index = teams.findIndex((t) => t.teamId === team.teamId);
  const next = index >= 0 ? teams.map((t, i) => (i === index ? team : t)) : [team, ...teams];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Deletes a team from AsyncStorage by its teamId. */
export async function deleteTeamFromStorage(teamId: string): Promise<SavedTeam[]> {
  const teams = await getAllSavedTeams();
  const next = teams.filter((t) => t.teamId !== teamId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Shrinks a picked photo so 11 of them fit comfortably in local storage. */
async function compressPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: PHOTO_WIDTH });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.7,
    base64: true,
  });
  if (!result.base64) throw new Error('Photo could not be encoded');
  return `data:image/jpeg;base64,${result.base64}`;
}

/* -------------------------------------------------------------------------- */
/*  Formations                                                                */
/* -------------------------------------------------------------------------- */

const FORMATION_COORDINATES: Record<number, Position[]> = {
  3: [{ x: 50, y: 88 }, { x: 30, y: 48 }, { x: 70, y: 48 }],
  4: [{ x: 50, y: 88 }, { x: 30, y: 60 }, { x: 70, y: 60 }, { x: 50, y: 28 }],
  5: [{ x: 50, y: 88 }, { x: 25, y: 65 }, { x: 75, y: 65 }, { x: 35, y: 35 }, { x: 65, y: 35 }],
  6: [{ x: 50, y: 88 }, { x: 25, y: 68 }, { x: 75, y: 68 }, { x: 50, y: 45 }, { x: 30, y: 25 }, { x: 70, y: 25 }],
  7: [{ x: 50, y: 88 }, { x: 20, y: 68 }, { x: 50, y: 70 }, { x: 80, y: 68 }, { x: 35, y: 40 }, { x: 65, y: 40 }, { x: 50, y: 20 }],
  8: [{ x: 50, y: 88 }, { x: 20, y: 70 }, { x: 50, y: 72 }, { x: 80, y: 70 }, { x: 30, y: 45 }, { x: 70, y: 45 }, { x: 35, y: 22 }, { x: 65, y: 22 }],
  9: [{ x: 50, y: 88 }, { x: 20, y: 72 }, { x: 50, y: 74 }, { x: 80, y: 72 }, { x: 20, y: 48 }, { x: 50, y: 48 }, { x: 80, y: 48 }, { x: 35, y: 22 }, { x: 65, y: 22 }],
  10: [{ x: 50, y: 88 }, { x: 18, y: 72 }, { x: 40, y: 74 }, { x: 60, y: 74 }, { x: 82, y: 72 }, { x: 30, y: 48 }, { x: 70, y: 48 }, { x: 20, y: 25 }, { x: 50, y: 22 }, { x: 80, y: 25 }],
  11: [{ x: 50, y: 88 }, { x: 15, y: 72 }, { x: 38, y: 75 }, { x: 62, y: 75 }, { x: 85, y: 72 }, { x: 20, y: 48 }, { x: 50, y: 52 }, { x: 80, y: 48 }, { x: 20, y: 24 }, { x: 50, y: 18 }, { x: 80, y: 24 }],
};

const DEFAULT_NAMES = [
  'Keeper', 'Defender L', 'Defender C1', 'Defender C2', 'Defender R',
  'Midfield L', 'Midfield C', 'Midfield R', 'Winger L', 'Striker', 'Winger R',
];

function createDefaultPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    name: DEFAULT_NAMES[i] || `Player ${i + 1}`,
    number: i + 1,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Draggable player token                                                    */
/* -------------------------------------------------------------------------- */

interface DraggablePlayerProps {
  player: Player;
  isGoalkeeper: boolean;
  position: Position;
  isSelected: boolean;
  pitchSize: { width: number; height: number };
  onToggleSelect: (id: string) => void;
  onPositionChange: (id: string, coords: Position) => void;
  onPickPhoto: (id: string) => void;
}

function DraggablePlayerToken({
  player,
  isGoalkeeper,
  position,
  isSelected,
  pitchSize,
  onToggleSelect,
  onPositionChange,
  onPickPhoto,
}: DraggablePlayerProps) {
  const pan = useRef(new Animated.ValueXY()).current;

  const currentPosRef = useRef(position);
  currentPosRef.current = position;

  const isSelectedRef = useRef(isSelected);
  isSelectedRef.current = isSelected;

  const pitchSizeRef = useRef(pitchSize);
  pitchSizeRef.current = pitchSize;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gesture) =>
          isSelectedRef.current && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
        onPanResponderGrant: () => {
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, gesture) => {
          const width = pitchSizeRef.current.width || 1;
          const height = pitchSizeRef.current.height || 1;

          const nextX = Math.max(5, Math.min(95, Math.round(currentPosRef.current.x + (gesture.dx / width) * 100)));
          const nextY = Math.max(5, Math.min(95, Math.round(currentPosRef.current.y + (gesture.dy / height) * 100)));

          pan.setValue({ x: 0, y: 0 });
          onPositionChange(player.id, { x: nextX, y: nextY });
        },
        onPanResponderTerminate: () => {
          pan.setValue({ x: 0, y: 0 });
        },
      }),
    [player.id, onPositionChange, pan]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.playerTokenContainer,
        {
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: isSelected ? 1.15 : 1 },
          ],
          zIndex: isSelected ? 100 : 1,
        },
      ]}>
      <View style={styles.tokenCircleWrapper}>
        <Pressable
          onPress={() => onToggleSelect(player.id)}
          style={[
            styles.playerJersey,
            isGoalkeeper ? styles.gkJersey : styles.fieldJersey,
            isSelected && styles.playerJerseySelected,
          ]}>
          {player.photoUri ? (
            <Image source={{ uri: player.photoUri }} style={styles.playerAvatar} resizeMode="cover" />
          ) : (
            <ThemedText style={styles.playerNumber}>{player.number}</ThemedText>
          )}
        </Pressable>

        <Pressable
          hitSlop={8}
          onPress={() => onPickPhoto(player.id)}
          accessibilityRole="button"
          accessibilityLabel={`Add photo for ${player.name}`}
          style={({ pressed }) => [styles.addPhotoButton, pressed && styles.pressed]}>
          <View style={styles.plusHorizontal} />
          <View style={styles.plusVertical} />
        </Pressable>
      </View>

      <ThemedText numberOfLines={1} style={styles.playerName}>
        {player.name}
      </ThemedText>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function FootballPlannerScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [currentTeamName, setCurrentTeamName] = useState<string>('My Tactical Squad');
  const [playerCount, setPlayerCount] = useState<number>(11);
  const [players, setPlayers] = useState<Player[]>(() => createDefaultPlayers(11));

  // Modals
  const [isConfigModalVisible, setConfigModalVisible] = useState(false);
  const [isSaveModalVisible, setSaveModalVisible] = useState(false);
  const [isLoadModalVisible, setLoadModalVisible] = useState(false);
  const [savedTeamsList, setSavedTeamsList] = useState<SavedTeam[]>([]);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Position & selection state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<Record<string, Position>>({});
  const [pitchLayout, setPitchLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Toast
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const activeCoordinates = FORMATION_COORDINATES[playerCount] || [];

  const showTeamFormation = useCallback((team: SavedTeam) => {
    if (!team || !Array.isArray(team.players) || team.players.length === 0) return;

    const restored: Record<string, Position> = { ...(team.positions ?? {}) };
    team.players.forEach((p) => {
      if (!restored[p.id] && p.position) restored[p.id] = p.position;
    });

    setCurrentTeamId(team.teamId);
    setCurrentTeamName(team.teamName || 'Untitled Squad');
    setPlayerCount(team.players.length);
    setPlayers(team.players);
    setCustomPositions(restored);
    setSelectedPlayerId(null);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedPlayerId((prev) => (prev === id ? null : id));
  }, []);

  const handlePositionChange = useCallback((id: string, coords: Position) => {
    setCustomPositions((prev) => ({ ...prev, [id]: coords }));
  }, []);

  const handleUpdatePlayerCount = (count: number) => {
    setPlayerCount(count);
    setSelectedPlayerId(null);
    setCustomPositions({});

    setPlayers((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      const next = [...prev];
      for (let i = next.length; i < count; i++) {
        next.push({
          id: `${i + 1}`,
          name: DEFAULT_NAMES[i] || `Player ${i + 1}`,
          number: i + 1,
        });
      }
      return next;
    });
  };

  const handleUpdatePlayer = (index: number, field: 'name' | 'number', value: string) => {
    setPlayers((prev) => {
      const copy = [...prev];
      if (field === 'number') {
        const parsed = parseInt(value, 10);
        copy[index] = { ...copy[index], number: isNaN(parsed) ? 0 : parsed };
      } else {
        copy[index] = { ...copy[index], name: value };
      }
      return copy;
    });
  };

  const handlePickPhoto = useCallback(
    async (playerId: string) => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (result.canceled) return;

        const asset = result.assets?.[0];
        if (!asset) return;

        const photoUri = await compressPhoto(asset.uri);
        setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, photoUri } : p)));
      } catch (error) {
        console.warn('Photo pick failed:', error);
        showNotice('Could not load that photo. Try another one.');
      }
    },
    [showNotice]
  );

  const openSaveDialog = () => {
    setSelectedPlayerId(null);
    setTeamNameInput(currentTeamName);
    setSaveError(null);
    setSaveModalVisible(true);
  };

  const handleSaveTeam = async (asNew: boolean) => {
    const name = teamNameInput.trim();
    if (!name) {
      setSaveError('Enter a team name.');
      return;
    }
    if (isSaving) return;

    const teamId = !asNew && currentTeamId ? currentTeamId : `team_${Date.now()}`;

    const positions: Record<string, Position> = {};
    players.forEach((player, index) => {
      positions[player.id] = customPositions[player.id] ?? activeCoordinates[index] ?? { x: 50, y: 50 };
    });

    const newTeam: SavedTeam = {
      teamId,
      teamName: name,
      playerCount: players.length,
      players,
      positions,
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await saveTeamToStorage(newTeam);
      setCurrentTeamId(teamId);
      setCurrentTeamName(name);
      setSaveModalVisible(false);
      showNotice(`"${name}" saved`);
    } catch (error) {
      console.warn('Save failed:', error);
      setSaveError('Could not save the team. Your device storage may be full.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenLoadModal = async () => {
    setSelectedPlayerId(null);
    setSavedTeamsList(await getAllSavedTeams());
    setLoadModalVisible(true);
  };

  // Perform delete operation
  const executeDelete = async (teamId: string, teamName: string) => {
    try {
      const updatedList = await deleteTeamFromStorage(teamId);
      setSavedTeamsList(updatedList);
      if (currentTeamId === teamId) {
        setCurrentTeamId(null);
      }
      showNotice(`"${teamName}" deleted`);
    } catch (error) {
      console.warn('Delete failed:', error);
      showNotice('Failed to delete formation');
    }
  };

  // Prompt confirmation before deleting
  const handleDeleteTeam = (teamId: string, teamName: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${teamName}"?`);
      if (confirmed) {
        executeDelete(teamId, teamName);
      }
      return;
    }

    Alert.alert(
      'Delete Formation',
      `Are you sure you want to delete "${teamName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeDelete(teamId, teamName),
        },
      ]
    );
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: safeAreaInsets.top,
      paddingLeft: safeAreaInsets.left,
      paddingRight: safeAreaInsets.right,
      paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    },
    web: {
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four,
    },
    default: {
      paddingTop: safeAreaInsets.top,
      paddingLeft: safeAreaInsets.left,
      paddingRight: safeAreaInsets.right,
      paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.two,
    },
  });

  return (
    <ThemedView style={[styles.screen, contentPlatformStyle, { backgroundColor: theme.background }]}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">{currentTeamName}</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            {selectedPlayerId
              ? '⚡ Player unlocked: Drag to move!'
              : `Tap a player to unlock & drag • Tap + to add a photo • ${playerCount} Players`}
          </ThemedText>
        </ThemedView>

        {/* Tactical Pitch Container */}
        <View style={styles.pitchWrapper}>
          <Pressable
            style={styles.pitch}
            onPress={() => setSelectedPlayerId(null)}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setPitchLayout({ width, height });
            }}>
            {/* Field Lines & Markers */}
            <View pointerEvents="none" style={styles.pitchBoundary} />
            <View pointerEvents="none" style={styles.halfwayLine} />
            <View pointerEvents="none" style={styles.centerCircle}>
              <View style={styles.centerSpot} />
            </View>
            <View pointerEvents="none" style={[styles.penaltyArea, styles.topPenaltyArea]} />
            <View pointerEvents="none" style={[styles.goalArea, styles.topGoalArea]} />
            <View pointerEvents="none" style={[styles.penaltyArea, styles.bottomPenaltyArea]} />
            <View pointerEvents="none" style={[styles.goalArea, styles.bottomGoalArea]} />

            {/* Tactical Players */}
            {players.map((player, index) => {
              const defaultPosition = activeCoordinates[index] || { x: 50, y: 50 };
              const position = customPositions[player.id] || defaultPosition;

              return (
                <DraggablePlayerToken
                  key={player.id}
                  player={player}
                  isGoalkeeper={index === 0}
                  position={position}
                  isSelected={selectedPlayerId === player.id}
                  pitchSize={pitchLayout}
                  onToggleSelect={handleToggleSelect}
                  onPositionChange={handlePositionChange}
                  onPickPhoto={handlePickPhoto}
                />
              );
            })}
          </Pressable>
        </View>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBarRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => setConfigModalVisible(true)}>
            <ThemedText style={styles.secondaryButtonText}>⚙️ Squad</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={openSaveDialog}>
            <ThemedText style={styles.primaryButtonText}>💾 Save Team</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={handleOpenLoadModal}>
            <ThemedText style={styles.secondaryButtonText}>📂 Load</ThemedText>
          </Pressable>
        </View>

        {notice ? (
          <View pointerEvents="none" style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </ThemedView>

      {/* Squad Configuration Modal */}
      <Modal
        visible={isConfigModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConfigModalVisible(false)}>
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="subtitle">Squad Configuration</ThemedText>
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
              onPress={() => setConfigModalVisible(false)}>
              <ThemedText style={styles.doneButtonText}>Done</ThemedText>
            </Pressable>
          </ThemedView>

          {!isKeyboardVisible && (
            <>
              <ThemedText style={styles.sectionLabel}>Select Team Size</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.countSelectorRow}>
                {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((count) => (
                  <Pressable
                    key={count}
                    style={[styles.countBadge, playerCount === count && styles.countBadgeActive]}
                    onPress={() => handleUpdatePlayerCount(count)}>
                    <ThemedText
                      style={[styles.countBadgeText, playerCount === count && styles.countBadgeTextActive]}>
                      {count}v{count}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <ThemedText style={styles.sectionLabel}>Edit Lineup & Photos</ThemedText>
          <ScrollView style={styles.playerInputList} keyboardShouldPersistTaps="handled">
            {players.map((item, index) => (
              <View key={item.id} style={styles.playerInputRow}>
                <ThemedText style={styles.playerSlotIndex}>#{index + 1}</ThemedText>

                <Pressable style={styles.modalPhotoBadge} onPress={() => handlePickPhoto(item.id)}>
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles.modalPlayerPhoto} />
                  ) : (
                    <Text style={styles.modalAddPhotoText}>📷+</Text>
                  )}
                </Pressable>

                <TextInput
                  style={styles.numberInput}
                  keyboardType="numeric"
                  value={item.number.toString()}
                  onChangeText={(val) => handleUpdatePlayer(index, 'number', val)}
                  maxLength={2}
                  placeholder="No."
                />
                <TextInput
                  style={styles.nameInput}
                  value={item.name}
                  onChangeText={(val) => handleUpdatePlayer(index, 'name', val)}
                  placeholder="Player Name"
                />
              </View>
            ))}
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Save Team Modal */}
      <Modal
        visible={isSaveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.dialogOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedView style={styles.dialogContainer}>
            <ThemedText type="subtitle" style={styles.dialogTitle}>
              {currentTeamId ? 'Update Formation' : 'Save Formation'}
            </ThemedText>
            <ThemedText style={styles.dialogDescription}>
              Enter a team name to save this formation and player lineup:
            </ThemedText>

            <TextInput
              style={styles.dialogInput}
              value={teamNameInput}
              onChangeText={(val) => {
                setTeamNameInput(val);
                if (saveError) setSaveError(null);
              }}
              placeholder="e.g. Dream Team XI"
              placeholderTextColor="#888"
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => handleSaveTeam(false)}
            />
            {saveError ? <Text style={styles.dialogErrorText}>{saveError}</Text> : null}

            <View style={styles.dialogButtonRow}>
              <Pressable
                style={[styles.dialogBtn, styles.dialogCancelBtn]}
                onPress={() => setSaveModalVisible(false)}>
                <ThemedText style={styles.dialogCancelText}>Cancel</ThemedText>
              </Pressable>

              <Pressable
                disabled={isSaving}
                style={[styles.dialogBtn, styles.dialogSaveBtn, isSaving && styles.pressed]}
                onPress={() => handleSaveTeam(false)}>
                <ThemedText style={styles.dialogSaveText}>
                  {isSaving ? 'Saving…' : currentTeamId ? 'Update' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>

            {currentTeamId ? (
              <Pressable
                disabled={isSaving}
                style={({ pressed }) => [styles.saveAsNewButton, pressed && styles.pressed]}
                onPress={() => handleSaveTeam(true)}>
                <Text style={styles.saveAsNewText}>Save as a new team</Text>
              </Pressable>
            ) : null}
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Load Saved Formations Modal */}
      <Modal
        visible={isLoadModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLoadModalVisible(false)}>
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="subtitle">Saved Formations</ThemedText>
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
              onPress={() => setLoadModalVisible(false)}>
              <ThemedText style={styles.doneButtonText}>Close</ThemedText>
            </Pressable>
          </ThemedView>

          {savedTeamsList.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyStateText}>
                No saved formations yet. Tap Save Team to store the current one.
              </ThemedText>
            </ThemedView>
          ) : (
            <ScrollView style={styles.savedTeamsList}>
              {savedTeamsList.map((team) => (
                <Pressable
                  key={team.teamId}
                  style={({ pressed }) => [styles.savedTeamCard, pressed && styles.pressed]}
                  onPress={() => {
                    showTeamFormation(team);
                    setLoadModalVisible(false);
                  }}>
                  <View style={styles.savedTeamCardHeader}>
                    <ThemedText style={styles.savedTeamName}>{team.teamName}</ThemedText>

                    <View style={styles.savedTeamHeaderActions}>
                      <View style={styles.savedTeamBadge}>
                        <ThemedText style={styles.savedTeamBadgeText}>
                          {team.playerCount}v{team.playerCount}
                        </ThemedText>
                      </View>

                      {/* Delete Symbol / Button */}
                      <Pressable
                        hitSlop={8}
                        accessibilityLabel={`Delete formation ${team.teamName}`}
                        style={({ pressed }) => [styles.deleteTeamButton, pressed && styles.pressed]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteTeam(team.teamId, team.teamName);
                        }}>
                        <Text style={styles.deleteTeamIcon}>🗑️</Text>
                      </Pressable>
                    </View>
                  </View>
                  <ThemedText style={styles.savedTeamMeta}>
                    Saved: {new Date(team.createdAt).toLocaleDateString()} • {team.players.length} players
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  bottomBarRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1.2,
    maxWidth: 160,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#374151',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    maxWidth: 120,
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  notice: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 300,
    elevation: 20,
  },
  noticeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pitchWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.one,
  },
  pitch: {
    width: '100%',
    maxWidth: 380,
    height: '100%',
    maxHeight: 520,
    aspectRatio: 1 / 1.45,
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
  },
  pitchBoundary: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  halfwayLine: {
    position: 'absolute',
    top: '50%',
    left: 6,
    right: 6,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 90,
    height: 90,
    marginLeft: -45,
    marginTop: -45,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerSpot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  penaltyArea: {
    position: 'absolute',
    width: 140,
    height: 70,
    left: '50%',
    marginLeft: -70,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  topPenaltyArea: {
    top: 6,
    borderTopWidth: 0,
  },
  bottomPenaltyArea: {
    bottom: 6,
    borderBottomWidth: 0,
  },
  goalArea: {
    position: 'absolute',
    width: 70,
    height: 30,
    left: '50%',
    marginLeft: -35,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  topGoalArea: {
    top: 6,
    borderTopWidth: 0,
  },
  bottomGoalArea: {
    bottom: 6,
    borderBottomWidth: 0,
  },
  playerTokenContainer: {
    position: 'absolute',
    width: 70,
    marginLeft: -35,
    marginTop: -18,
    alignItems: 'center',
  },
  tokenCircleWrapper: {
    width: 36,
    height: 36,
  },
  playerJersey: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  playerJerseySelected: {
    borderColor: '#38bdf8',
    borderWidth: 3,
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  playerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  addPhotoButton: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0a7ea4',
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 10,
    elevation: 10,
  },
  plusHorizontal: {
    position: 'absolute',
    left: 4,
    top: 7,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ffffff',
  },
  plusVertical: {
    position: 'absolute',
    left: 7,
    top: 4,
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#ffffff',
  },
  gkJersey: {
    backgroundColor: '#f59e0b',
  },
  fieldJersey: {
    backgroundColor: '#dc2626',
  },
  playerNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerName: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalContainer: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.six,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  doneButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 15,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  countSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: Spacing.three,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  countBadgeActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  countBadgeTextActive: {
    color: '#ffffff',
  },
  playerInputList: {
    flex: 1,
    marginTop: Spacing.two,
  },
  playerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.two,
  },
  playerSlotIndex: {
    width: 28,
    fontSize: 12,
    color: '#888',
  },
  modalPhotoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  modalPlayerPhoto: {
    width: '100%',
    height: '100%',
  },
  modalAddPhotoText: {
    fontSize: 12,
    color: '#4b5563',
  },
  numberInput: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  nameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#1f2937',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  dialogDescription: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  dialogInput: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 12,
  },
  dialogErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 12,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  dialogBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dialogCancelBtn: {
    backgroundColor: 'transparent',
  },
  dialogCancelText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  dialogSaveBtn: {
    backgroundColor: '#0a7ea4',
  },
  dialogSaveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  saveAsNewButton: {
    alignItems: 'center',
    paddingTop: 14,
  },
  saveAsNewText: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
  },
  savedTeamsList: {
    flex: 1,
    marginTop: 10,
  },
  savedTeamCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  savedTeamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  savedTeamHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedTeamName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  savedTeamBadge: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savedTeamBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteTeamButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTeamIcon: {
    fontSize: 14,
  },
  savedTeamMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },
});