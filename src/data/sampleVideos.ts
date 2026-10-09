import { VideoSource } from '../types';

export const SAMPLE_VIDEOS: VideoSource[] = [
  {
    id: 'sample-rogan-musk',
    title: 'Joe Rogan & Elon Musk: The Truth About Humanoid Robots & AGI',
    creator: 'PowerfulJRE',
    channelName: 'Joe Rogan Experience #2054',
    duration: 120,
    thumbnail: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=1200&q=80',
    videoUrl: '/samples/podcast.mp4',
    sourceType: 'sample',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Elon Musk explains the exponential speed of robotics, Tesla Optimus, and why AI will make money obsolete within our lifetimes.',
    transcript: `[00:00] Joe: You know what freaks me out about the new humanoid robots? It's not that they can walk. It's how eerily quiet they are now.
[00:08] Elon: Yeah, well, human joints are actually surprisingly noisy compared to electric actuators. An electric motor is almost silent until it's carrying massive torque.
[00:19] Joe: But man, wait! Last year they looked like a toddler learning to take three steps without falling over on a banana peel. Now they're doing backflips and sorting batteries at 60 frames a second!
[00:32] Elon: (laughs) The rate of progress is nonlinear. People constantly make the mistake of linear extrapolation. They think whatever happened in the last 12 months is what happens in the next 12 months.
[00:46] Joe: But it's compounding! It's doubling every six months!
[00:51] Elon: Exactly. When you have neural nets trained on synthetic physics simulations running at 10,000 times real-time, the robot has lived 500 lifetimes before it takes its first physical step in the factory.
[01:08] Joe: That's terrifying and awesome at the same time. What happens when everyone has one? What is human work then?
[01:17] Elon: If robots can manufacture goods and produce food at virtually zero marginal cost, the economy changes completely. Poverty becomes an artificial constraint. Everything gets cheaper by an order of magnitude.
[01:34] Joe: Wait, so nobody has to work a 9 to 5 they hate?
[01:39] Elon: Work becomes strictly optional. It's like playing sports or painting. You do it because you enjoy the craft, not because you need rent tokens to survive another Tuesday.
[01:52] Joe: (laughs hysterically) Rent tokens! Bro, that's literally what dollars are right now! You just gave the landlord 2,000 rent tokens so you don't freeze outside!
[02:05] Elon: It really is. Currency is just an information system for labor and energy allocation. When labor and energy are effectively limitless, currency has to re-evaluate its purpose.
[02:22] Joe: Bro, my mind is completely scrambled right now. You're talking about the end of human drudgery.
[02:30] Elon: It's either an age of unprecedented abundance, or we accidentally build the Terminator. We really need to make sure the off switch is not a software update.
[02:44] Joe: (laughing) Can you imagine? 'Sorry, off button cannot be clicked while rebooting to SkyNet version 4.2'
[02:55] Elon: That's why physical safety interlocks must remain hardware-level and physically disconnected from the main brain.`,
    highlights: [
      {
        id: 'clip-1',
        title: '😂 Elon Calls US Dollars "Rent Tokens" & Joe Loses It!',
        hook: 'Wait... are dollars just rent tokens?! 🤯',
        reason: 'Relatable humor about inflation and hilarious delivery with Joe Rogan bursting into laughter.',
        category: 'funny',
        startTime: 10,
        endTime: 38,
        viralityScore: 98,
        hookScore: 99,
        flowScore: 96,
        emojis: ['😂', '💸', '🤯'],
        hashtags: ['#elonmusk', '#joerogan', '#relatable', '#funnyclips', '#podcast'],
        recommendedMusicTempo: 'funny',
        captions: [
          {
            start: 0,
            end: 4.2,
            text: "Wait, so nobody has to work a 9 to 5 they hate?",
            emphasisWord: "HATE",
            words: [
              { w: "Wait,", start: 0, end: 0.6 },
              { w: "so", start: 0.6, end: 0.9 },
              { w: "nobody", start: 0.9, end: 1.5 },
              { w: "has", start: 1.5, end: 1.8 },
              { w: "to", start: 1.8, end: 2.0 },
              { w: "work", start: 2.0, end: 2.4 },
              { w: "a", start: 2.4, end: 2.6 },
              { w: "9 to 5", start: 2.6, end: 3.3 },
              { w: "they", start: 3.3, end: 3.6 },
              { w: "hate?", start: 3.6, end: 4.2 },
            ],
          },
          {
            start: 4.5,
            end: 8.8,
            text: "Work becomes strictly optional. Like playing sports or painting.",
            emphasisWord: "OPTIONAL",
            words: [
              { w: "Work", start: 4.5, end: 4.9 },
              { w: "becomes", start: 4.9, end: 5.5 },
              { w: "strictly", start: 5.5, end: 6.1 },
              { w: "optional.", start: 6.1, end: 6.9 },
              { w: "Like", start: 6.9, end: 7.3 },
              { w: "playing", start: 7.3, end: 7.8 },
              { w: "sports", start: 7.8, end: 8.3 },
              { w: "or painting.", start: 8.3, end: 8.8 },
            ],
          },
          {
            start: 9.0,
            end: 14.5,
            text: "You do it for craft, not because you need rent tokens to survive Tuesday!",
            emphasisWord: "RENT TOKENS",
            words: [
              { w: "You", start: 9.0, end: 9.3 },
              { w: "do it", start: 9.3, end: 9.8 },
              { w: "for", start: 9.8, end: 10.1 },
              { w: "the craft,", start: 10.1, end: 10.7 },
              { w: "not", start: 10.7, end: 11.1 },
              { w: "because", start: 11.1, end: 11.6 },
              { w: "you need", start: 11.6, end: 12.2 },
              { w: "rent", start: 12.2, end: 12.7 },
              { w: "tokens", start: 12.7, end: 13.3 },
              { w: "to survive", start: 13.3, end: 13.9 },
              { w: "Tuesday!", start: 13.9, end: 14.5 },
            ],
          },
          {
            start: 14.8,
            end: 19.5,
            text: "BRO! That is literally what dollars are right now! RENT TOKENS!",
            emphasisWord: "DOLLARS",
            words: [
              { w: "BRO!", start: 14.8, end: 15.4 },
              { w: "That", start: 15.4, end: 15.8 },
              { w: "is", start: 15.8, end: 16.0 },
              { w: "literally", start: 16.0, end: 16.6 },
              { w: "what", start: 16.6, end: 16.9 },
              { w: "dollars", start: 16.9, end: 17.5 },
              { w: "are", start: 17.5, end: 17.8 },
              { w: "right now!", start: 17.8, end: 18.5 },
              { w: "RENT", start: 18.5, end: 19.0 },
              { w: "TOKENS!", start: 19.0, end: 19.5 },
            ],
          },
        ],
      },
      {
        id: 'clip-2',
        title: '🤖 Why Robots Learn 10,000x Faster Than Humans',
        hook: 'Humanoid robots just lived 500 lifetimes in 1 night! 🤯',
        reason: 'Mindblowing AI insight that stops users scrolling with insane visualization of simulation training.',
        category: 'highlight',
        startTime: 40,
        endTime: 74,
        viralityScore: 94,
        hookScore: 97,
        flowScore: 92,
        emojis: ['🤖', '⚡', '🧠'],
        hashtags: ['#ai', '#robotics', '#futuretech', '#mindblown', '#shorts'],
        recommendedMusicTempo: 'dramatic',
        captions: [
          {
            start: 0,
            end: 4.8,
            text: "People constantly make the mistake of linear extrapolation.",
            emphasisWord: "LINEAR",
            words: [
              { w: "People", start: 0, end: 0.5 },
              { w: "constantly", start: 0.5, end: 1.2 },
              { w: "make", start: 1.2, end: 1.6 },
              { w: "the mistake", start: 1.6, end: 2.4 },
              { w: "of linear", start: 2.4, end: 3.2 },
              { w: "extrapolation.", start: 3.2, end: 4.8 },
            ],
          },
          {
            start: 5.2,
            end: 10.5,
            text: "They think whatever happened in the last 12 months is what happens next.",
            emphasisWord: "NEXT",
            words: [
              { w: "They think", start: 5.2, end: 6.0 },
              { w: "whatever happened", start: 6.0, end: 7.2 },
              { w: "in the last", start: 7.2, end: 8.0 },
              { w: "12 months", start: 8.0, end: 9.0 },
              { w: "is what happens", start: 9.0, end: 9.8 },
              { w: "next.", start: 9.8, end: 10.5 },
            ],
          },
          {
            start: 11.0,
            end: 16.5,
            text: "In simulation at 10,000x speed, the robot lives 500 lifetimes in one night!",
            emphasisWord: "500 LIFETIMES",
            words: [
              { w: "In simulation", start: 11.0, end: 12.0 },
              { w: "at 10,000x", start: 12.0, end: 13.0 },
              { w: "speed,", start: 13.0, end: 13.5 },
              { w: "the robot lives", start: 13.5, end: 14.5 },
              { w: "500", start: 14.5, end: 15.2 },
              { w: "lifetimes", start: 15.2, end: 15.8 },
              { w: "in one night!", start: 15.8, end: 16.5 },
            ],
          },
        ],
      },
      {
        id: 'clip-3',
        title: '💀 "Don\'t Make The Off Switch a Software Update!"',
        hook: 'Elon Musk warns about the robot off-switch disaster! 🚨',
        reason: 'Dark comedic banter about Terminator and software crashes.',
        category: 'funny',
        startTime: 78,
        endTime: 112,
        viralityScore: 92,
        hookScore: 94,
        flowScore: 90,
        emojis: ['💀', '🚨', '🤖'],
        hashtags: ['#terminator', '#elonmusk', '#funny', '#techhumor'],
        recommendedMusicTempo: 'funny',
        captions: [
          {
            start: 0,
            end: 4.5,
            text: "We really need to make sure the off switch is not a software update.",
            emphasisWord: "OFF SWITCH",
            words: [
              { w: "We really", start: 0, end: 0.8 },
              { w: "need to ensure", start: 0.8, end: 1.8 },
              { w: "the off switch", start: 1.8, end: 2.8 },
              { w: "is not a", start: 2.8, end: 3.5 },
              { w: "software update.", start: 3.5, end: 4.5 },
            ],
          },
          {
            start: 4.8,
            end: 9.8,
            text: "'Sorry! Cannot turn off while rebooting to SkyNet version 4.2!'",
            emphasisWord: "SKYNET",
            words: [
              { w: "'Sorry!", start: 4.8, end: 5.6 },
              { w: "Cannot turn off", start: 5.6, end: 6.8 },
              { w: "while rebooting", start: 6.8, end: 7.9 },
              { w: "to SkyNet", start: 7.9, end: 8.8 },
              { w: "version 4.2!'", start: 8.8, end: 9.8 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sample-mrbeast-challenge',
    title: 'MrBeast: $1,000,000 Laser Maze & Island Survival Challenge',
    creator: 'MrBeast',
    channelName: 'MrBeast Official',
    duration: 120,
    thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    videoUrl: '/samples/challenge.mp4',
    sourceType: 'sample',
    youtubeUrl: 'https://www.youtube.com/watch?v=0e3GPea1Tyg',
    description: 'We locked 100 people in a giant grid. If you touch a single laser beam, you lose $100,000 on the spot!',
    transcript: `[00:00] Jimmy: I am giving away one million dollars right now, but there is a catch. If you touch this red laser beam, you immediately forfeit your suitcase of cash!
[00:11] Chandler: Jimmy, wait, is that a real laser or a special effect?
[00:15] Jimmy: Touch it Chandler! See what happens!
[00:18] (alarm blares, smoke puffs)
[00:20] Chandler: AHHHH! My eyebrows almost got vaporized!
[00:24] Jimmy: That was warning laser number one! We have 40 contestants remaining on the platform!
[00:33] Nolan: Bro, this guy in the blue shirt has been standing on one foot for three hours straight.
[00:39] Jimmy: Sir, what is your strategy?
[00:42] Contestant: My rent is due tomorrow. That laser has to kill me before I step off this block!
[00:48] Jimmy: (screaming) THAT IS THE ENERGY WE NEED FOR ONE MILLION DOLLARS!
[00:54] Karl: Look at the left side! The walls are moving inwards!
[01:02] Jimmy: Every 60 seconds, the room shrinks by two feet. In five minutes, there won't even be enough space to sneeze!
[01:14] Contestant: I have to sneeze right now! Oh no, oh no!
[01:19] (Contestant sneezes, trips into laser, fireworks explode)
[01:23] Jimmy: HE SNEEZED HIMSELF OUT OF A HUNDRED GRAND! That is the most expensive sneeze in human history!`,
    highlights: [
      {
        id: 'beast-clip-1',
        title: '🤧 The Most Expensive Sneeze in Human History ($100,000 FAIL!)',
        hook: 'He sneezed away $100,000 in 0.5 seconds! 💸😱',
        reason: 'Instant viral shock comedy, intense stakes, and hilarious climactic fail.',
        category: 'funny',
        startTime: 12,
        endTime: 44,
        viralityScore: 99,
        hookScore: 100,
        flowScore: 98,
        emojis: ['🤧', '💸', '💥'],
        hashtags: ['#mrbeast', '#fails', '#funny', '#viral', '#challenge'],
        recommendedMusicTempo: 'upbeat',
        captions: [
          {
            start: 0,
            end: 4.0,
            text: "Every 60 seconds, this room shrinks by two feet!",
            emphasisWord: "SHRINKS",
            words: [
              { w: "Every", start: 0, end: 0.5 },
              { w: "60 seconds,", start: 0.5, end: 1.5 },
              { w: "this room", start: 1.5, end: 2.4 },
              { w: "shrinks", start: 2.4, end: 3.1 },
              { w: "by two feet!", start: 3.1, end: 4.0 },
            ],
          },
          {
            start: 4.2,
            end: 8.5,
            text: "In five minutes, there won't even be space to sneeze!",
            emphasisWord: "SNEEZE",
            words: [
              { w: "In five minutes,", start: 4.2, end: 5.5 },
              { w: "there won't", start: 5.5, end: 6.4 },
              { w: "even be space", start: 6.4, end: 7.5 },
              { w: "to sneeze!", start: 7.5, end: 8.5 },
            ],
          },
          {
            start: 8.8,
            end: 14.5,
            text: "OH NO! HE SNEEZED HIMSELF OUT OF A HUNDRED GRAND!",
            emphasisWord: "$100,000",
            words: [
              { w: "OH NO!", start: 8.8, end: 9.8 },
              { w: "HE SNEEZED", start: 9.8, end: 11.2 },
              { w: "HIMSELF OUT", start: 11.2, end: 12.3 },
              { w: "OF A HUNDRED", start: 12.3, end: 13.4 },
              { w: "GRAND!", start: 13.4, end: 14.5 },
            ],
          },
        ],
      },
      {
        id: 'beast-clip-2',
        title: '🔥 "My Rent Is Due Tomorrow - The Laser Has To Kill Me!"',
        hook: 'When your rent is due and $1,000,000 is on the line 😂',
        reason: 'Unmatched relatable grit that drives comment section engagement like crazy.',
        category: 'funny',
        startTime: 48,
        endTime: 82,
        viralityScore: 96,
        hookScore: 98,
        flowScore: 94,
        emojis: ['😂', '🔥', '💰'],
        hashtags: ['#relatable', '#mrbeast', '#grindset', '#comedy'],
        recommendedMusicTempo: 'upbeat',
        captions: [
          {
            start: 0,
            end: 3.8,
            text: "Sir, what is your winning strategy?",
            emphasisWord: "STRATEGY",
            words: [
              { w: "Sir,", start: 0, end: 0.6 },
              { w: "what is", start: 0.6, end: 1.4 },
              { w: "your winning", start: 1.4, end: 2.5 },
              { w: "strategy?", start: 2.5, end: 3.8 },
            ],
          },
          {
            start: 4.0,
            end: 8.9,
            text: "My rent is due tomorrow. That laser has to kill me first!",
            emphasisWord: "KILL ME",
            words: [
              { w: "My rent", start: 4.0, end: 4.9 },
              { w: "is due tomorrow.", start: 4.9, end: 6.2 },
              { w: "That laser", start: 6.2, end: 7.2 },
              { w: "has to kill me", start: 7.2, end: 8.2 },
              { w: "first!", start: 8.2, end: 8.9 },
            ],
          },
          {
            start: 9.2,
            end: 13.5,
            text: "THAT IS THE ENERGY WE NEED FOR ONE MILLION DOLLARS!",
            emphasisWord: "$1,000,000",
            words: [
              { w: "THAT IS", start: 9.2, end: 9.9 },
              { w: "THE ENERGY", start: 9.9, end: 10.8 },
              { w: "WE NEED FOR", start: 10.8, end: 11.9 },
              { w: "ONE MILLION", start: 11.9, end: 12.8 },
              { w: "DOLLARS!", start: 12.8, end: 13.5 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sample-huberman-dopamine',
    title: 'Dr. Andrew Huberman: The 2-Minute Morning Hack for Laser Focus',
    creator: 'Huberman Lab',
    channelName: 'Neuroscience & High Performance',
    duration: 120,
    thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    videoUrl: '/samples/nature.mp4',
    sourceType: 'sample',
    youtubeUrl: 'https://www.youtube.com/watch?v=gXDMoiEkyuQ',
    description: 'Why drinking coffee the first 90 minutes after waking up is secretly ruining your afternoon energy and creating anxiety spikes.',
    transcript: `[00:00] Andrew: If you wake up tired and reach for coffee within the first ten minutes, you are making a massive neurochemical mistake.
[00:10] Host: Wait, Andrew, literally the entire world drinks coffee first thing in the morning! What are we doing wrong?
[00:18] Andrew: Here is what happens inside your brain. Throughout the day, a chemical called adenosine builds up. Adenosine creates sleep pressure.
[00:30] Host: The tiredness feeling.
[00:33] Andrew: Exactly. When you sleep, adenosine is cleared out. But if you didn't sleep eight hours, residual adenosine remains in your receptors.
[00:44] When you drink caffeine immediately, caffeine binds to those adenosine receptors and blocks them like a lock and key.
[00:54] But notice: it does not destroy adenosine. It just hides it.
[01:01] Then around 2:00 PM, when the caffeine metabolizes and drops off the receptor, all that stacked-up adenosine crashes into your brain simultaneously!
[01:14] Host: That's the 2 PM afternoon slump! That's why everyone crashes!
[01:21] Andrew: Bingo. The solution is dead simple: delay your caffeine intake by 90 to 120 minutes after waking.
[01:32] Instead, get natural morning sunlight into your eyes for five minutes and drink 16 ounces of water with a pinch of sea salt.
[01:43] That clears adenosine naturally, spikes your cortisol peak at the right time, and completely prevents the 2 PM crash forever.`,
    highlights: [
      {
        id: 'huberman-clip-1',
        title: '☕ Why Morning Coffee Is Ruining Your Energy (The 90-Min Rule)',
        hook: 'Stop drinking coffee first thing in the morning! 🛑☕',
        reason: 'Immediate actionable health hack with huge viral curiosity gap ("I\'ve been doing it wrong my whole life").',
        category: 'educational',
        startTime: 6,
        endTime: 34,
        viralityScore: 97,
        hookScore: 98,
        flowScore: 95,
        emojis: ['☕', '🛑', '🧠'],
        hashtags: ['#hubermanlab', '#healthhacks', '#productivity', '#coffee', '#morningroutine'],
        recommendedMusicTempo: 'dramatic',
        captions: [
          {
            start: 0,
            end: 4.5,
            text: "If you reach for coffee in the first 10 minutes, you're making a massive mistake.",
            emphasisWord: "MISTAKE",
            words: [
              { w: "If you", start: 0, end: 0.6 },
              { w: "reach for coffee", start: 0.6, end: 1.8 },
              { w: "in the first", start: 1.8, end: 2.6 },
              { w: "10 minutes,", start: 2.6, end: 3.4 },
              { w: "you're making a", start: 3.4, end: 4.0 },
              { w: "massive mistake.", start: 4.0, end: 4.5 },
            ],
          },
          {
            start: 4.8,
            end: 9.5,
            text: "Literally the entire world drinks coffee first thing! What is happening?",
            emphasisWord: "WORLD",
            words: [
              { w: "Literally", start: 4.8, end: 5.5 },
              { w: "the entire world", start: 5.5, end: 6.8 },
              { w: "drinks coffee", start: 6.8, end: 7.9 },
              { w: "first thing!", start: 7.9, end: 8.6 },
              { w: "What is happening?", start: 8.6, end: 9.5 },
            ],
          },
          {
            start: 9.8,
            end: 15.0,
            text: "Caffeine does not destroy your tiredness. It just blocks it like a lock and key!",
            emphasisWord: "LOCK & KEY",
            words: [
              { w: "Caffeine", start: 9.8, end: 10.5 },
              { w: "does not destroy", start: 10.5, end: 11.8 },
              { w: "tiredness.", start: 11.8, end: 12.6 },
              { w: "It just blocks it", start: 12.6, end: 13.8 },
              { w: "like a lock and key!", start: 13.8, end: 15.0 },
            ],
          },
        ],
      },
      {
        id: 'huberman-clip-2',
        title: '⚡ The Real Reason You Crash Every Day at 2 PM',
        hook: 'Why do we always crash at 2:00 PM? Science explains 😴',
        reason: 'Universal shared human experience explained with simple visual logic.',
        category: 'educational',
        startTime: 36,
        endTime: 68,
        viralityScore: 95,
        hookScore: 96,
        flowScore: 94,
        emojis: ['😴', '⚡', '💡'],
        hashtags: ['#afternooncrash', '#focus', '#biohacking', '#learnontiktok'],
        recommendedMusicTempo: 'chill',
        captions: [
          {
            start: 0,
            end: 4.8,
            text: "Around 2:00 PM, when caffeine drops, adenosine crashes in all at once!",
            emphasisWord: "CRASHES",
            words: [
              { w: "Around 2:00 PM,", start: 0, end: 1.2 },
              { w: "when caffeine drops,", start: 1.2, end: 2.6 },
              { w: "adenosine crashes", start: 2.6, end: 3.8 },
              { w: "in all at once!", start: 3.8, end: 4.8 },
            ],
          },
          {
            start: 5.0,
            end: 9.8,
            text: "Delay caffeine by 90 minutes. That eliminates the crash forever!",
            emphasisWord: "FOREVER",
            words: [
              { w: "Delay caffeine", start: 5.0, end: 6.2 },
              { w: "by 90 minutes.", start: 6.2, end: 7.5 },
              { w: "That eliminates", start: 7.5, end: 8.6 },
              { w: "the crash forever!", start: 8.6, end: 9.8 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sample-standup-comedy',
    title: 'Stand-Up Crowd Work: Comedian Roasts Finance Bro Who Lied About Salary',
    creator: 'Comedy Central Vault',
    channelName: 'Live Crowd Work Specials',
    duration: 120,
    thumbnail: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=1200&q=80',
    videoUrl: '/samples/comedy.mp4',
    sourceType: 'sample',
    youtubeUrl: 'https://www.youtube.com/watch?v=live-comedy-special',
    description: 'Front row heckler claims he makes 7 figures in private equity, but his date whispers the truth directly into the microphone.',
    transcript: `[00:00] Comedian: What do you do for work, sir? You look like you sell vape pens to middle schoolers behind a 7-Eleven.
[00:09] Man: Private equity! High-yield portfolio acquisitions!
[00:15] Comedian: (laughs) High-yield portfolio acquisitions?! That's a lot of syllables to say you're unemployed on LinkedIn!
[00:24] (Audience erupts in laughter)
[00:27] Comedian: Miss, is he telling the truth? How long have you guys been dating?
[00:32] Woman: Two weeks.
[00:34] Comedian: Two weeks?! And he brought you to the front row of a comedy club?! He's brave or he has no self-preservation instinct!
[00:44] Woman: (whispers into mic) He drove a 2004 Honda Civic with one mismatching purple door to pick me up.
[00:54] Comedian: (screaming) A PURPLE DOOR?! Sir, did you acquire that door at a high-yield auction behind a junkyard?!
[01:05] Man: (red faced) It was a limited edition JDM import!
[01:10] Comedian: A limited edition rust import! Give it up for high finance, ladies and gentlemen!`,
    highlights: [
      {
        id: 'comedy-clip-1',
        title: '🚗 Date Exposes Finance Bro\'s "Purple Door" Honda Civic! (ROAST)',
        hook: 'She destroyed his whole career in 5 words 💀😭',
        reason: 'Peak stand-up comedy roast, organic crowd work twist, unscripted dating embarrassment.',
        category: 'funny',
        startTime: 8,
        endTime: 38,
        viralityScore: 99,
        hookScore: 99,
        flowScore: 98,
        emojis: ['💀', '🚗', '😭'],
        hashtags: ['#standup', '#crowdwork', '#comedyroast', '#datingfail', '#funnyvideos'],
        recommendedMusicTempo: 'funny',
        captions: [
          {
            start: 0,
            end: 4.2,
            text: "Miss, is he telling the truth? How long have you two been dating?",
            emphasisWord: "DATING",
            words: [
              { w: "Miss, is he", start: 0, end: 0.8 },
              { w: "telling the truth?", start: 0.8, end: 2.0 },
              { w: "How long", start: 2.0, end: 2.8 },
              { w: "have you two", start: 2.8, end: 3.5 },
              { w: "been dating?", start: 3.5, end: 4.2 },
            ],
          },
          {
            start: 4.5,
            end: 9.8,
            text: "He drove a 2004 Honda Civic with one mismatching PURPLE door!",
            emphasisWord: "PURPLE DOOR",
            words: [
              { w: "He drove a", start: 4.5, end: 5.4 },
              { w: "2004", start: 5.4, end: 6.2 },
              { w: "Honda Civic", start: 6.2, end: 7.3 },
              { w: "with one mismatching", start: 7.3, end: 8.5 },
              { w: "PURPLE DOOR!", start: 8.5, end: 9.8 },
            ],
          },
          {
            start: 10.2,
            end: 15.5,
            text: "Did you acquire that door at a high-yield auction behind a junkyard?!",
            emphasisWord: "JUNKYARD",
            words: [
              { w: "Did you acquire", start: 10.2, end: 11.4 },
              { w: "that door", start: 11.4, end: 12.2 },
              { w: "at a high-yield auction", start: 12.2, end: 13.8 },
              { w: "behind a", start: 13.8, end: 14.5 },
              { w: "junkyard?!", start: 14.5, end: 15.5 },
            ],
          },
        ],
      },
    ],
  },
];
