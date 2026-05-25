-- ============================================
-- DARK ALTER EGO - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_emoji text default '😈',
  evil_score integer default 0,
  games_played integer default 0,
  highest_evil integer default 0,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ============================================
-- QUESTIONS
-- ============================================
create table questions (
  id uuid default uuid_generate_v4() primary key,
  text text not null,
  level integer not null check (level between 1 and 4),
  category text default 'general',
  is_active boolean default true,
  play_count integer default 0,
  created_at timestamp with time zone default now()
);

alter table questions enable row level security;
create policy "Questions are viewable by everyone" on questions for select using (true);

-- Insert default questions
insert into questions (text, level, category) values
-- Level 1 - اختيارات أخلاقية
('كدبت على حد قريب منك وما اتندمتش — إيه كان الكدب ده؟', 1, 'moral'),
('في حاجة بتتمنى تعملها بس الخوف من رأي الناس بيمنعك، إيه هي؟', 1, 'moral'),
('لو تقدر تعرف أي سر لأي شخص في حياتك، مين هتختار وليه؟', 1, 'curiosity'),
('إيه أكتر حاجة اشتهيتها ومش اتكلمتش فيها مع حد؟', 1, 'desire'),
('في موقف حكمت فيه على حد بسرعة وبعدين اتأسفت — إيه كان؟', 1, 'judgment'),

-- Level 2 - نوايا مخفية
('لو تعرف إن مفيش حد هيعرف، إيه أكتر حاجة هتعملها دلوقتي؟', 2, 'hidden'),
('في حد في حياتك بتتمنى تشوفه بيتعذب شوية — مين ده؟', 2, 'dark'),
('أكتر حاجة حسدت فيها حد وحسيت بفرحة لما بطلت معاه؟', 2, 'envy'),
('لو تقدر تسرق موهبة أو حياة حد من غير ما يحس، مين هتختار؟', 2, 'desire'),
('إيه أكتر فكرة مظلمة راحت في بالك وقلت لنفسك ماشي كده؟', 2, 'dark'),
('لو في شخص في حياتك ممكن تختاره يروح من حياتك، مين ده؟', 2, 'relationships'),

-- Level 3 - الجزء المظلم
('لو تعرف إنك مش هتتحاسب خالص، مين اللي كنت هتأذيه؟', 3, 'dark'),
('إيه أقوى انتقام فكرت فيه وحسيت إنه عادل؟', 3, 'revenge'),
('في لحظة اتمنيت فيها تبدل حياتك بحياة شخص تاني كاملة — مين؟', 3, 'identity'),
('لو عندك إمكانية تمسح ذكرى واحدة من ذاكرة حد بيحبك، هتمسح إيه؟', 3, 'power'),
('إيه أكتر حاجة عملتها وكنت عارف إنها غلط بس عملتها على طول؟', 3, 'guilt'),
('لو تعرف إن حد قريب منك هيموت بكره — هتغير حاجة في تعاملك معاه؟', 3, 'mortality'),

-- Level 4 - النفس الحقيقية
('إيه أكتر حاجة بتكدب فيها على نفسك كل يوم وبتصدقها؟', 4, 'truth'),
('لو حياتك اتصورت فيلم وناس شافوه — إيه الجزء اللي كنت هتتمنى يتحذف؟', 4, 'shame'),
('إيه اللي لو عرفه أقرب ناس ليك كانوا هيبعدوا عنك؟', 4, 'secret'),
('في لحظة في حياتك كنت فيها شخص مختلف تماماً — مين كنت؟', 4, 'identity'),
('لو تقدر تغير قرار واحد في حياتك، إيه اللي مش هتغيره حتى لو الكل قالك غلطان؟', 4, 'regret');

-- ============================================
-- ROOMS
-- ============================================
create table rooms (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  host_id uuid references profiles(id),
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  current_question_index integer default 0,
  current_question_id uuid references questions(id),
  max_players integer default 8,
  question_timer integer default 30,
  questions_per_game integer default 7,
  level_filter integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table rooms enable row level security;
create policy "Rooms are viewable by everyone" on rooms for select using (true);
create policy "Authenticated users can create rooms" on rooms for insert with check (auth.uid() = host_id);
create policy "Host can update room" on rooms for update using (auth.uid() = host_id);

-- ============================================
-- ROOM PLAYERS
-- ============================================
create table room_players (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  anonymous_name text not null,
  anonymous_avatar text not null,
  anonymous_color text not null,
  evil_score integer default 0,
  is_ready boolean default false,
  has_answered boolean default false,
  is_online boolean default true,
  joined_at timestamp with time zone default now(),
  unique(room_id, user_id)
);

alter table room_players enable row level security;
create policy "Room players viewable by everyone" on room_players for select using (true);
create policy "Users can join rooms" on room_players for insert with check (auth.uid() = user_id);
create policy "Users can update their own player" on room_players for update using (auth.uid() = user_id);

-- ============================================
-- MESSAGES (Room Chat)
-- ============================================
create table messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references room_players(id) on delete cascade,
  anonymous_name text not null,
  anonymous_avatar text not null,
  content text not null,
  message_type text default 'chat' check (message_type in ('chat', 'system', 'reaction')),
  created_at timestamp with time zone default now()
);

alter table messages enable row level security;
create policy "Messages viewable by everyone" on messages for select using (true);
create policy "Players can send messages" on messages for insert with check (
  exists (
    select 1 from room_players
    where room_players.id = player_id
    and room_players.user_id = auth.uid()
  )
);

-- ============================================
-- ANSWERS
-- ============================================
create table answers (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  question_id uuid references questions(id),
  player_id uuid references room_players(id) on delete cascade,
  answer_text text not null,
  is_custom boolean default false,
  evil_weight integer default 1,
  created_at timestamp with time zone default now(),
  unique(room_id, question_id, player_id)
);

alter table answers enable row level security;
create policy "Answers viewable by everyone" on answers for select using (true);
create policy "Players can submit answers" on answers for insert with check (
  exists (
    select 1 from room_players
    where room_players.id = player_id
    and room_players.user_id = auth.uid()
  )
);

-- ============================================
-- VOTES
-- ============================================
create table votes (
  id uuid default uuid_generate_v4() primary key,
  answer_id uuid references answers(id) on delete cascade,
  voter_player_id uuid references room_players(id) on delete cascade,
  room_id uuid references rooms(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(answer_id, voter_player_id)
);

alter table votes enable row level security;
create policy "Votes viewable by everyone" on votes for select using (true);
create policy "Players can vote" on votes for insert with check (
  exists (
    select 1 from room_players
    where room_players.id = voter_player_id
    and room_players.user_id = auth.uid()
  )
);

-- ============================================
-- FRIENDSHIPS
-- ============================================
create table friendships (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references profiles(id) on delete cascade,
  addressee_id uuid references profiles(id) on delete cascade,
  requester_anonymous_name text,
  status text default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  met_in_room uuid references rooms(id),
  created_at timestamp with time zone default now(),
  unique(requester_id, addressee_id)
);

alter table friendships enable row level security;
create policy "Users can view their friendships" on friendships for select using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);
create policy "Users can send friend requests" on friendships for insert with check (auth.uid() = requester_id);
create policy "Users can update friendships" on friendships for update using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- ============================================
-- REALTIME - Enable for all tables
-- ============================================
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table votes;

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_emoji)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'لاعب_' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'avatar', '😈')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- FUNCTION: Generate unique room code
-- ============================================
create or replace function generate_room_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..4 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$ language plpgsql;
