import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Service role client for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ActiveChallenge {
  id: string;
  start_date: string;
  end_date: string;
  checkin_time: string;
}

interface ChallengeMember {
  user_id: string;
  user_name: string;
}

async function getActiveChallenges(): Promise<ActiveChallenge[]> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const { data, error } = await supabase
    .from('challenges')
    .select('id, start_date, end_date, checkin_time')
    .lte('start_date', today)
    .gte('end_date', today);

  if (error) {
    console.error('Error fetching active challenges:', error);
    throw error;
  }

  return data || [];
}

async function getChallengeMembers(challengeId: string): Promise<ChallengeMember[]> {
  const { data, error } = await supabase.rpc('get_challenge_members', {
    p_challenge_id: challengeId
  });

  if (error) {
    console.error(`Error fetching members for challenge ${challengeId}:`, error);
    return [];
  }

  return data || [];
}

async function hasCheckInForDate(challengeId: string, userId: string, date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('check_ins')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error(`Error checking existing check-in:`, error);
    return false;
  }

  return !!data;
}

async function createFailCheckIn(challengeId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase.rpc('upsert_check_in', {
    p_challenge_id: challengeId,
    p_date: date,
    p_status: 'fail',
    p_screenshot_name: null
  });

  if (error) {
    console.error(`Error creating fail check-in for user ${userId} on ${date}:`, error);
    throw error;
  }
}

async function processChallenge(challenge: ActiveChallenge): Promise<number> {
  console.log(`Processing challenge: ${challenge.id}`);
  
  const members = await getChallengeMembers(challenge.id);
  console.log(`Found ${members.length} members for challenge ${challenge.id}`);
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // Only process yesterday - never today or future dates
  const startDate = new Date(challenge.start_date);
  const processDate = new Date(Math.max(startDate.getTime(), yesterday.getTime()));
  
  if (processDate > yesterday) {
    console.log(`Challenge ${challenge.id} started today or in future, skipping`);
    return 0;
  }

  let failsCreated = 0;

  for (const member of members) {
    const hasCheckIn = await hasCheckInForDate(challenge.id, member.user_id, yesterdayStr);
    
    if (!hasCheckIn) {
      console.log(`Creating fail check-in for user ${member.user_name} (${member.user_id}) on ${yesterdayStr}`);
      await createFailCheckIn(challenge.id, member.user_id, yesterdayStr);
      failsCreated++;
    }
  }

  console.log(`Created ${failsCreated} fail check-ins for challenge ${challenge.id}`);
  return failsCreated;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-fail-checkins job');
    const startTime = new Date();

    const activeChallenges = await getActiveChallenges();
    console.log(`Found ${activeChallenges.length} active challenges`);

    let totalFailsCreated = 0;

    for (const challenge of activeChallenges) {
      try {
        const failsCreated = await processChallenge(challenge);
        totalFailsCreated += failsCreated;
      } catch (error) {
        console.error(`Error processing challenge ${challenge.id}:`, error);
        // Continue with other challenges even if one fails
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result = {
      success: true,
      processedChallenges: activeChallenges.length,
      totalFailsCreated,
      durationMs: duration,
      timestamp: new Date().toISOString()
    };

    console.log('Auto-fail-checkins job completed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in auto-fail-checkins function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

Deno.serve(handler);