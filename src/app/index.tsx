import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/* -------------------------------------------------------------------------- */
/*  Saved teams (same storage key + shape the planner screen saves with)      */
/* -------------------------------------------------------------------------- */

interface Position {
  x: number;
  y: number;
}

interface Player {
  id: string;
  name: string;
  number: number;
  photoUri?: string;
  position?: Position;
}

interface SavedTeam {
  teamId: string;
  teamName: string;
  playerCount: number;
  players: Player[];
  positions?: Record<string, Position>;
  createdAt: string;
}

const STORAGE_KEY = '@football_planner_saved_teams';

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
async function getAllSavedTeams(): Promise<SavedTeam[]> {
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

function getPlayerPosition(team: SavedTeam, player: Player): Position {
  return team.positions?.[player.id] ?? player.position ?? { x: 50, y: 50 };
}

function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* -------------------------------------------------------------------------- */
/*  Read-only pitch that shows a saved formation                              */
/* -------------------------------------------------------------------------- */

function TeamFormationView({ team }: { team: SavedTeam }) {
  return (
    <View style={styles.pitch}>
      {/* Field lines & markers */}
      <View style={styles.pitchBoundary} />
      <View style={styles.halfwayLine} />
      <View style={styles.centerCircle}>
        <View style={styles.centerSpot} />
      </View>
      <View style={[styles.penaltyArea, styles.topPenaltyArea]} />
      <View style={[styles.goalArea, styles.topGoalArea]} />
      <View style={[styles.penaltyArea, styles.bottomPenaltyArea]} />
      <View style={[styles.goalArea, styles.bottomGoalArea]} />

      {/* Players at their saved positions */}
      {team.players.map((player, index) => {
        const position = getPlayerPosition(team, player);

        return (
          <View
            key={player.id}
            style={[
              styles.playerToken,
              { left: `${position.x}%`, top: `${position.y}%` },
            ]}>
            <View style={[styles.playerJersey, index === 0 ? styles.gkJersey : styles.fieldJersey]}>
              {player.photoUri ? (
                <Image source={{ uri: player.photoUri }} style={styles.playerAvatar} resizeMode="cover" />
              ) : (
                <Text style={styles.playerNumber}>{player.number}</Text>
              )}
            </View>
            <Text numberOfLines={1} style={styles.playerName}>
              {player.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function HomeScreen() {
  const [teams, setTeams] = useState<SavedTeam[] | null>(null);
  const [viewerTeam, setViewerTeam] = useState<SavedTeam | null>(null);
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isAboutOpen, setAboutOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllSavedTeams().then((saved) => {
        if (active) setTeams(saved);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const openTeam = (team: SavedTeam) => {
    setViewerTeam(team);
    setViewerOpen(true);
  };

  const handleContactPress = () => {
    Linking.openURL('mailto:sarangp.dev@gmail.com').catch(() => {
      Alert.alert('Contact', 'Reach out via sarangp.dev@gmail.com');
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Info button in the top header */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="About this app"
            onPress={() => setAboutOpen(true)}
            style={({ pressed }) => [styles.infoBadge, pressed && styles.pressed]}>
            <Text style={styles.infoBadgeText}>i</Text>
          </Pressable>
        </View>

        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Plan Your Team
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          History
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          {teams === null ? (
            <ThemedText type="small" style={styles.emptyText}>
              Loading…
            </ThemedText>
          ) : teams.length === 0 ? (
            <ThemedText type="small" style={styles.emptyText}>
              No teams yet. Build a lineup in the planner and tap Save Team.
            </ThemedText>
          ) : (
            <ScrollView
              style={styles.historyList}
              contentContainerStyle={styles.historyContent}
              showsVerticalScrollIndicator={false}>
              {teams.map((team) => {
                const date = formatSavedDate(team.createdAt);
                const label = `${team.players.length}v${team.players.length}${date ? ` • ${date}` : ''}`;

                return (
                  <Pressable
                    key={team.teamId}
                    accessibilityRole="button"
                    accessibilityLabel={`Show team ${team.teamName}`}
                    onPress={() => openTeam(team)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <HintRow
                      title={team.teamName}
                      hint={<ThemedText type="code">{label}</ThemedText>}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>

      {/* Info / About Modal */}
      <Modal
        visible={isAboutOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAboutOpen(false)}>
        <View style={styles.aboutBackdrop}>
          <ThemedView style={styles.aboutCard}>
            <View style={styles.aboutIconCircle}>
              <Text style={styles.aboutIconText}>⚽</Text>
            </View>

            <ThemedText type="subtitle" style={styles.aboutTitle}>
              Team Planner
            </ThemedText>

            <ThemedText type="default" style={styles.aboutDescription}>
              Craft custom match tactics, adjust pitch positions on the fly, and save your squad formations for quick matchday reference. Designed to keep team organization effortless.
            </ThemedText>

            <View style={styles.aboutDivider} />

            <ThemedText type="small" style={styles.developerHeading}>
              DEVELOPED BY
            </ThemedText>
            <ThemedText style={styles.developerName}>
              Sarang P
            </ThemedText>

            <Pressable onPress={handleContactPress} style={styles.emailContainer}>
              <ThemedText type="small" style={styles.developerEmail}>
                sarangp.dev@gmail.com
              </ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.aboutCloseButton, pressed && styles.pressed]}
              onPress={() => setAboutOpen(false)}>
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Saved formation viewer */}
      <Modal
        visible={isViewerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewerOpen(false)}>
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedView style={styles.modalTitleBlock}>
              <ThemedText type="subtitle" numberOfLines={1}>
                {viewerTeam?.teamName ?? ''}
              </ThemedText>
              {viewerTeam ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {viewerTeam.players.length}v{viewerTeam.players.length}
                  {formatSavedDate(viewerTeam.createdAt)
                    ? ` • saved ${formatSavedDate(viewerTeam.createdAt)}`
                    : ''}
                </ThemedText>
              ) : null}
            </ThemedView>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              onPress={() => setViewerOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </ThemedView>

          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {viewerTeam ? <TeamFormationView team={viewerTeam} /> : null}
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: Spacing.one,
  },
  infoBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(128, 128, 128, 0.4)',
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    opacity: 0.75,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  historyList: {
    maxHeight: 260,
  },
  historyContent: {
    gap: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },

  /* About Modal */
  aboutBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  aboutCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: Spacing.five,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  aboutIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(10, 126, 164, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  aboutIconText: {
    fontSize: 26,
  },
  aboutTitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  aboutDescription: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.85,
    marginBottom: Spacing.three,
  },
  aboutDivider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(128, 128, 128, 0.25)',
    marginVertical: Spacing.two,
  },
  developerHeading: {
    letterSpacing: 1.2,
    opacity: 0.6,
    fontSize: 10,
  },
  developerName: {
    fontSize: 16,
    marginTop: 2,
  },
  emailContainer: {
    marginTop: 4,
    marginBottom: Spacing.four,
  },
  developerEmail: {
    color: '#0a7ea4',
    textDecorationLine: 'underline',
  },
  aboutCloseButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },

  /* Viewer modal */
  modalContainer: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.five,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  modalTitleBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  closeButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalScrollContent: {
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },

  /* Pitch */
  pitch: {
    width: '100%',
    maxWidth: 380,
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
  playerToken: {
    position: 'absolute',
    width: 70,
    marginLeft: -35,
    marginTop: -18,
    alignItems: 'center',
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
  gkJersey: {
    backgroundColor: '#f59e0b',
  },
  fieldJersey: {
    backgroundColor: '#dc2626',
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
});