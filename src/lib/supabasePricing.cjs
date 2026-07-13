const SUPABASE_PRICING = {
  database: {
    computeRatePerHour: 0.08,
    storageRatePerGbMonth: 0.125,
    storageEgressRatePerGb: 0.09,
    minimumMonthlyCost: 25,
  },
  auth: {
    monthlyActiveUserRate: 0.0025,
    freeThreshold: 5000,
  },
  realtime: {
    channelRatePerMonth: 3.5,
    messageRatePerMonth: 0.0008,
  },
  telemetry: {
    eventsRatePer1000: 0.001,
  },
  edge: {
    requestsRatePer1000: 0.0005,
  },
  cdn: {
    transferRatePerGb: 0.02,
  },
  storage: {
    bucketRatePerGbMonth: 0.02,
  },
};

function calculateSupabaseMonthlyEstimate(snapshot) {
  const database = Math.max(
    SUPABASE_PRICING.database.minimumMonthlyCost,
    (snapshot.databaseGbHours ?? 0) * SUPABASE_PRICING.database.computeRatePerHour +
      (snapshot.databaseCpuHours ?? 0) * SUPABASE_PRICING.database.computeRatePerHour * 0.0004
  );

  const storage = (snapshot.storageGb ?? 0) * SUPABASE_PRICING.database.storageRatePerGbMonth;
  const storageEgress = (snapshot.storageEgressGb ?? 0) * SUPABASE_PRICING.database.storageEgressRatePerGb;
  const bucketStorage = (snapshot.storageBucketGb ?? 0) * SUPABASE_PRICING.storage.bucketRatePerGbMonth;
  const authUsers = snapshot.authMonthlyActiveUsers ?? 0;
  const auth = Math.max(0, authUsers - SUPABASE_PRICING.auth.freeThreshold) * SUPABASE_PRICING.auth.monthlyActiveUserRate;
  const realtime = (snapshot.realtimeChannels ?? 0) * SUPABASE_PRICING.realtime.channelRatePerMonth + (snapshot.realtimeMessages ?? 0) * SUPABASE_PRICING.realtime.messageRatePerMonth;
  const telemetry = ((snapshot.telemetryEvents ?? 0) / 1000) * SUPABASE_PRICING.telemetry.eventsRatePer1000;
  const cdn = (snapshot.storageEgressGb ?? 0) * SUPABASE_PRICING.cdn.transferRatePerGb;
  const edge = ((snapshot.realtimeMessages ?? 0) / 1000) * SUPABASE_PRICING.edge.requestsRatePer1000;

  const items = {
    database,
    storage: storage + storageEgress + bucketStorage,
    auth,
    realtime,
    telemetry,
    cdn,
    edge,
  };

  const totalMonthlyCost = Object.values(items).reduce((sum, value) => sum + value, 0);
  const confidence = snapshot.confidence || 'medium';
  const source = snapshot.source || 'estimation';

  return {
    totalMonthlyCost,
    items,
    summary: `Estimated monthly cost for ${snapshot.projectKey || 'supabase'}: $${totalMonthlyCost.toFixed(2)} (confidence: ${confidence}, source: ${source})`,
    confidence,
    source,
  };
}

function formatCost(amount) {
  return `$${amount.toFixed(2)}`;
}

module.exports = {
  SUPABASE_PRICING,
  calculateSupabaseMonthlyEstimate,
  formatCost,
};
