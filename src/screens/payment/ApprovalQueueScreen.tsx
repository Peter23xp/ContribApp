import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ContributionSubmission } from '../../services/contributionService';
import { Ionicons } from '@expo/vector-icons';
import { OfflineBanner } from '../../components/common/OfflineBanner';

// Mock currentUser Group ID
const groupId = 'testGroup';

export function ApprovalQueueScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  
  const [pendingQueue, setPendingQueue] = useState<ContributionSubmission[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Temps réel pour "En attente"
  useEffect(() => {
    const q = query(
      collection(db, 'contributions'),
      where('groupId', '==', groupId),
      where('status', '==', 'pending_approval'),
      orderBy('submittedAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContributionSubmission));
      setPendingQueue(items);
      setPendingCount(items.length);
      // Optionnel: Toast si new item added
    });

    return () => unsubscribe();
  }, []);

  // Fetch historique (Approuvées / Rejetées)
  useEffect(() => {
    if (activeTab === 'pending') return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const qStat = activeTab === 'approved' ? 'paid' : 'rejected';
        const dateField = activeTab === 'approved' ? 'paid_at' : 'rejected_at';

        // NOTE: Indexes might be needed here. 
        // For simplicity we order by serverTimestamp equivalent or submittedAt if custom dates not fully populated.
        const q = query(
          collection(db, 'contributions'),
          where('groupId', '==', groupId),
          where('status', '==', qStat),
          orderBy(dateField, 'desc'),
          limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistoryItems(items);
          setLoading(false);
        });

        return unsubscribe;
      } catch (e) {
        setLoading(false);
      }
    };

    const unsub = fetchHistory();
    return () => { unsub.then(fn => fn && fn()); };
  }, [activeTab]);

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === 'pending') {
      const isMatch = item.geminiAnalysis?.amount === item.amountDue;
      const getConfidenceColor = (conf: number) => conf >= 85 ? '#4CAF50' : conf >= 60 ? '#FF9800' : '#F44336';
      
      return (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReviewCapture', { contributionId: item.id })}>
          <View style={styles.cardContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.memberName}</Text>
              <Text style={styles.periodText}>Contribution {item.periodMonth}</Text>
              
              <View style={styles.amountsRow}>
                <Text style={styles.amountDueText}>Attendu: {item.amountDue} CDF</Text>
                <Text style={[styles.amountDetectedText, { color: isMatch ? '#4CAF50' : '#FF9800' }]}>
                  Détecté: {item.geminiAnalysis?.amount || '?'} CDF
                </Text>
              </View>

              <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(item.geminiAnalysis?.confidence || 0) + '20' }]}>
                <Text style={{ color: getConfidenceColor(item.geminiAnalysis?.confidence || 0), fontSize: 10, fontWeight: 'bold' }}>
                  IA: {Math.round(item.geminiAnalysis?.confidence || 0)}%
                </Text>
              </View>
            </View>
            {item.captureImageUrl && (
              <Image source={{ uri: item.captureImageUrl }} style={styles.thumbnail} />
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // Historique
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReviewCapture', { contributionId: item.id, readOnly: true })}>
        <View style={styles.cardContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{item.memberName || 'Inconnu'}</Text>
            <Text style={styles.periodText}>Contribution {item.periodMonth}</Text>
            {activeTab === 'approved' ? (
              <Text style={{ color: '#4CAF50', fontWeight: 'bold', marginTop: 4 }}>Approuvé: {item.amount_paid} CDF</Text>
            ) : (
              <Text style={{ color: '#F44336', fontStyle: 'italic', marginTop: 4, fontSize: 12 }}>Raison: {item.rejection_reason}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <OfflineBanner />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contributions à valider</Text>
        <View style={styles.badgeCount}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'pending' && styles.tabActive]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>En attente ({pendingCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'approved' && styles.tabActive]} onPress={() => setActiveTab('approved')}>
          <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>Approuvées</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'rejected' && styles.tabActive]} onPress={() => setActiveTab('rejected')}>
          <Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>Rejetées</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'pending' ? pendingQueue : historyItems}
        keyExtractor={item => item.id!}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => {}} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
              <Text style={styles.emptyText}>✓ Aucune contribution en attente de validation.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  badgeCount: { backgroundColor: '#F44336', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', elevation: 2 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2196F3' },
  tabText: { color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#2196F3' },
  
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, elevation: 1 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontWeight: 'bold', fontSize: 16 },
  periodText: { color: '#666', fontSize: 12, marginTop: 2 },
  amountsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  amountDueText: { color: '#757575', fontSize: 12 },
  amountDetectedText: { fontSize: 12, fontWeight: 'bold' },
  confidenceBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, marginLeft: 12 },
  
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#4CAF50', fontWeight: 'bold', marginTop: 12 }
});
