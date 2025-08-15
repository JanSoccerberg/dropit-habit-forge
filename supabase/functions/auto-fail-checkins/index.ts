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
  checkin_time: string; // TIME format (HH:MM:SS)
}

interface ChallengeMember {
  user_id: string;
  user_name: string;
}

interface EvaluationResult {
  challengeId: string;
  evaluatedDate: string;
  failsCreated: number;
  membersProcessed: number;
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

/**
 * Determines which date should be evaluated based on current time and challenge check-in deadline
 */
function getEvaluationDate(challenge: ActiveChallenge): string | null {
  const nowUtc = new Date();
  const todayStr = nowUtc.toISOString().split('T')[0];
  const yesterdayStr = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Calculate today's deadline (today + checkin_time)
  const todayDeadline = new Date(`${todayStr}T${challenge.checkin_time}Z`);
  
  // Determine evaluation date based on deadline logic
  let evaluationDate: string;
  if (nowUtc >= todayDeadline) {
    // Past deadline for today, evaluate today
    evaluationDate = todayStr;
  } else {
    // Before deadline for today, evaluate yesterday
    evaluationDate = yesterdayStr;
  }
  
  // Check if evaluation date is within challenge period
  if (evaluationDate < challenge.start_date || evaluationDate > challenge.end_date) {
    console.log(`Evaluation date ${evaluationDate} outside challenge period ${challenge.start_date} to ${challenge.end_date}`);
    return null;
  }
  
  console.log(`Challenge ${challenge.id}: Current time ${nowUtc.toISOString()}, deadline ${todayDeadline.toISOString()}, evaluating ${evaluationDate}`);
  return evaluationDate;
}

/**
 * Check if user has a timely successful check-in for the given date
 */
async function hasTimelySuccessCheckIn(challengeId: string, userId: string, date: string, deadline: Date): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_timely_success_checkin', {
    p_challenge_id: challengeId,
    p_user_id: userId,
    p_date: date,
    p_deadline: deadline.toISOString()
  });

  if (error) {
    console.error(`Error checking timely success for user ${userId} on ${date}:`, error);
    return false;
  }

  return data === true;
}

/**
 * Create locked fail check-in using the enhanced upsert function
 */
async function createLockedFailCheckIn(challengeId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase.rpc('upsert_check_in_with_deadline', {
    p_challenge_id: challengeId,
    p_date: date,
    p_status: 'fail',
    p_screenshot_name: null,
    p_source: 'system_cron',
    p_user_id: userId
  });

  if (error) {
    console.error(`Error creating locked fail check-in for user ${userId} on ${date}:`, error);
    throw error;
  }
}

/**
 * Process a single challenge with deadline-based evaluation
 */
async function processChallenge(challenge: ActiveChallenge): Promise<EvaluationResult> {
  console.log(`Processing challenge: ${challenge.id} (check-in time: ${challenge.checkin_time})`);
  
  const evaluationDate = getEvaluationDate(challenge);
  if (!evaluationDate) {
    return {
      challengeId: challenge.id,
      evaluatedDate: 'none',
      failsCreated: 0,
      membersProcessed: 0
    };
  }
  
  const members = await getChallengeMembers(challenge.id);
  console.log(`Found ${members.length} members for challenge ${challenge.id}, evaluating ${evaluationDate}`);
  
  // Calculate deadline for the evaluation date
  const deadline = new Date(`${evaluationDate}T${challenge.checkin_time}Z`);
  
  let failsCreated = 0;

  for (const member of members) {
    try {
      const hasTimelySuccess = await hasTimelySuccessCheckIn(
        challenge.id, 
        member.user_id, 
        evaluationDate, 
        deadline
      );
      
      if (!hasTimelySuccess) {
        console.log(`Creating locked fail for user ${member.user_name} (${member.user_id}) on ${evaluationDate} - no timely success before ${deadline.toISOString()}`);
        await createLockedFailCheckIn(challenge.id, member.user_id, evaluationDate);
        failsCreated++;
      } else {
        console.log(`User ${member.user_name} has timely success on ${evaluationDate}`);
      }
    } catch (error) {
      console.error(`Error processing member ${member.user_id}:`, error);
      // Continue with other members
    }
  }

  const result: EvaluationResult = {
    challengeId: challenge.id,
    evaluatedDate: evaluationDate,
    failsCreated,
    membersProcessed: members.length
  };
  
  console.log(`Challenge ${challenge.id} complete:`, result);
  return result;
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

    const results: EvaluationResult[] = [];
    let totalFailsCreated = 0;

    for (const challenge of activeChallenges) {
      try {
        const result = await processChallenge(challenge);
        results.push(result);
        totalFailsCreated += result.failsCreated;
      } catch (error) {
        console.error(`Error processing challenge ${challenge.id}:`, error);
        // Continue with other challenges even if one fails
        results.push({
          challengeId: challenge.id,
          evaluatedDate: 'error',
          failsCreated: 0,
          membersProcessed: 0
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const summary = {
      success: true,
      processedChallenges: activeChallenges.length,
      totalFailsCreated,
      durationMs: duration,
      timestamp: new Date().toISOString(),
      evaluationResults: results
    };

    console.log('Auto-fail-checkins job completed:', summary);

    return new Response(JSON.stringify(summary), {
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