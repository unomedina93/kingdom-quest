// ===== BIBLE STORIES DATA =====
// Choose-your-own-adventure Bible stories for young children
// Each story is exactly 4 screens: setup → choice/mini-game → resolution → end

const STORIES = {

  // ---- DAVID AND GOLIATH ----
  david_goliath: {
    id: 'david_goliath',
    title: 'David and the Giant',
    icon: '⚔️',
    bgColor: 'linear-gradient(180deg, #8b6914 0%, #4a3508 100%)',
    verse: '"Be strong and courageous!" — Joshua 1:9',
    lesson: 'God helps the brave!',
    pages: [
      {
        id: 'p1',
        art: '👦🏼',
        text: 'David was a small shepherd boy who loved God. One day a HUGE giant named Goliath was scaring everybody — but David was not afraid!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: 'David said, "I will face Goliath — God is with me!" Everyone was surprised. What do you think David should do?',
        choices: [
          { text: '⚔️ Be brave and face Goliath!', next: 'p3_brave' },
          { text: '🏃 Run away and hide', next: 'p3_run' }
        ]
      },
      {
        id: 'p3_brave',
        art: '💪',
        text: 'Brave David went to the river and picked 5 smooth stones. He trusted God completely! Help David get his stones!',
        miniGame: { type: 'count', target: 5, item: '🪨', prompt: 'Tap 5 stones for David!' },
        next: 'p4'
      },
      {
        id: 'p3_run',
        art: '🙏',
        text: 'David prayed and felt brave again! God gives us courage when we ask. He went and picked 5 smooth stones. Help David get them!',
        miniGame: { type: 'count', target: 5, item: '🪨', prompt: 'Tap 5 stones for David!' },
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🎉',
        text: 'David swung his sling — WHOOSH! The stone hit Goliath and the giant fell down with a big THUD! Everyone cheered! David won because he trusted God.',
        isEnd: true,
        verse: '"Be strong and courageous!" — Joshua 1:9',
        lesson: 'When we trust God, we can do amazing things — even when we are small!'
      }
    ]
  },

  // ---- NOAH\'S ARK ----
  noahs_ark: {
    id: 'noahs_ark',
    title: "Noah's Big Boat",
    icon: '🚢',
    bgColor: 'linear-gradient(180deg, #1a6b9a 0%, #0d3d5a 100%)',
    verse: '"Trust in the Lord with all your heart." — Proverbs 3:5',
    lesson: 'Obey God and He will take care of you!',
    pages: [
      {
        id: 'p1',
        art: '👨‍🦳',
        text: 'Noah loved God. One day God said, "Build a GIANT boat and bring two of every animal inside! Rain is coming!" Noah obeyed right away.',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🐘🦁',
        text: 'Animals came from everywhere — two by two! Help Noah match pairs of animals for the ark!',
        miniGame: { type: 'match-pairs', items: ['🐘', '🦁', '🦒', '🐧', '🐊'], prompt: 'Match each animal with its pair!' },
        next: 'p3'
      },
      {
        id: 'p3',
        art: '🌈',
        text: 'Rain came for 40 days! But inside the ark, everyone was SAFE and dry. When the sun came out, God put a rainbow in the sky as a promise of love.',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🕊️',
        text: 'Noah thanked God for keeping them safe. God said, "Every rainbow is my promise — I love you always!" And Noah smiled with joy.',
        isEnd: true,
        verse: '"Trust in the Lord with all your heart." — Proverbs 3:5',
        lesson: 'God always keeps His promises. When we obey Him, He takes care of us!'
      }
    ]
  },

  // ---- DANIEL AND THE LIONS ----
  daniel_lions: {
    id: 'daniel_lions',
    title: 'Daniel and the Lions',
    icon: '🦁',
    bgColor: 'linear-gradient(180deg, #4a1a00 0%, #1a0d00 100%)',
    verse: '"With God, all things are possible!" — Matthew 19:26',
    lesson: 'God protects those who love Him!',
    pages: [
      {
        id: 'p1',
        art: '🙏',
        text: 'Daniel prayed to God three times every day — even when mean men made a rule saying "No praying!" Daniel loved God too much to stop.',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '😰',
        text: 'Daniel was thrown into a den full of big, hungry lions! What do you think happened next?',
        choices: [
          { text: '😟 The lions were very scary', next: 'p3_scared' },
          { text: '🙏 Daniel prayed and trusted God', next: 'p3_faith' }
        ]
      },
      {
        id: 'p3_scared',
        art: '👼',
        text: 'The lions roared — but God sent an angel to shut every lion\'s mouth! Daniel sat safe all night. Count how many lions were there!',
        miniGame: { type: 'count', target: 6, item: '🦁', prompt: 'Count the lions in the den!' },
        next: 'p4'
      },
      {
        id: 'p3_faith',
        art: '✨',
        text: 'Daniel prayed and God sent an angel to close every single lion\'s mouth! Daniel sat peacefully all night. Count the lions!',
        miniGame: { type: 'count', target: 6, item: '🦁', prompt: 'Count the lions in the den!' },
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🎉👑',
        text: 'The king ran to the den: "Daniel! Are you safe?" "Yes! God sent His angel!" The king told everyone: "The God of Daniel is the GREAT God!"',
        isEnd: true,
        verse: '"With God, all things are possible!" — Matthew 19:26',
        lesson: 'When we trust God, He protects us even in scary situations!'
      }
    ]
  },

  // ---- THE LOST SHEEP ----
  lost_sheep: {
    id: 'lost_sheep',
    title: 'The Lost Sheep',
    icon: '🐑',
    bgColor: 'linear-gradient(180deg, #3a7a3a 0%, #1a4a1a 100%)',
    verse: '"God loves you very much!" — John 3:16',
    lesson: "You are never lost from God's love!",
    pages: [
      {
        id: 'p1',
        art: '👨‍🌾',
        text: 'A shepherd had 100 sheep and loved every one. But when he counted at night — one was MISSING! Little Woolly had wandered away.',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: 'He had 99 safe sheep at home. What should the shepherd do?',
        choices: [
          { text: '🔍 Go search for the lost sheep!', next: 'p3_search' },
          { text: '🏠 Stay home with the 99 safe ones', next: 'p3_stay' }
        ]
      },
      {
        id: 'p3_search',
        art: '🐑',
        text: 'The shepherd went into the dark night, never giving up! Finally he found Woolly scared in the bushes. He carried her home on his shoulders with a big smile!',
        next: 'p4'
      },
      {
        id: 'p3_stay',
        art: '💙',
        text: 'Jesus says the good shepherd ALWAYS goes looking — every sheep matters! He found Woolly in the bushes and carried her home on his shoulders with joy.',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🎉🏠',
        text: '"Come celebrate — my lost sheep is FOUND!" Jesus said, "That\'s how happy God is when someone comes to Him. You are never ever forgotten!"',
        isEnd: true,
        verse: '"God loves you very much!" — John 3:16',
        lesson: 'God loves YOU so much that He always comes looking for you. You are never forgotten!'
      }
    ]
  },

  // ---- CREATION ----
  creation: {
    id: 'creation',
    title: 'God Makes the World',
    icon: '🌍',
    bgColor: 'linear-gradient(180deg, #1a1a8a 0%, #000000 100%)',
    verse: '"Children are a gift from God." — Psalm 127:3',
    lesson: 'God made everything — including YOU — and it is very good!',
    pages: [
      {
        id: 'p1',
        art: '☀️🌊',
        text: 'In the beginning everything was dark! Then God spoke — LIGHT appeared! He made the sky, the oceans, and beautiful flowers and trees.',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🌞⭐',
        text: 'God put the sun in the sky for daytime and filled the night with twinkling stars! Count the stars with me!',
        miniGame: { type: 'count', target: 7, item: '⭐', prompt: 'Count 7 stars in the night sky!' },
        next: 'p3'
      },
      {
        id: 'p3',
        art: '🐠🦅🦁',
        text: 'God filled the sea with fish, the sky with birds, and the land with every animal! Then He made the most special thing of all — PEOPLE! He said, "This is VERY good!"',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🌟',
        text: 'And God made YOU! You are His most wonderful creation. He loves you more than all the stars in the sky. You are wonderfully made!',
        isEnd: true,
        verse: '"Children are a gift from God." — Psalm 127:3',
        lesson: 'God made YOU on purpose, with love. You are wonderful and very special to Him!'
      }
    ]
  },

  // ---- JONAH AND THE BIG FISH ----
  jonah_fish: {
    id: 'jonah_fish',
    title: 'Jonah and the Big Fish',
    icon: '🐋',
    bgColor: 'linear-gradient(180deg, #0d3b5e 0%, #050f1a 100%)',
    verse: '"Call on God and He will answer you." — Jonah 2:2',
    lesson: 'It is never too late to say sorry to God!',
    pages: [
      {
        id: 'p1',
        art: '⛵',
        text: 'God told Jonah to go help the city of Nineveh — but Jonah ran the other way! He got on a boat to sail far away. But a HUGE storm came!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '⛈️',
        text: 'The waves grew bigger and bigger! Everyone was very scared. What do you think Jonah should do?',
        choices: [
          { text: '🙏 Say sorry to God!', next: 'p3_sorry' },
          { text: '😴 Sleep through the storm', next: 'p3_sleep' }
        ]
      },
      {
        id: 'p3_sorry',
        art: '🐋',
        text: 'Jonah said, "This storm is my fault!" Splash — into the sea he went! A GIANT fish swallowed him whole. Count how many days he was inside!',
        miniGame: { type: 'count', target: 3, item: '🌙', prompt: 'Count 3 days inside the fish!' },
        next: 'p4'
      },
      {
        id: 'p3_sleep',
        art: '🐋',
        text: 'The captain woke Jonah up. Jonah knew the storm was his fault. Splash — into the sea he went! A GIANT fish swallowed him whole. Count the days inside!',
        miniGame: { type: 'count', target: 3, item: '🌙', prompt: 'Count 3 days inside the fish!' },
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🏙️',
        text: 'Inside the fish Jonah prayed: "I am sorry, God! I will obey!" God forgave him and the fish spat Jonah out — SPLAT! Jonah went to Nineveh and everyone listened!',
        isEnd: true,
        verse: '"Call on God and He will answer you." — Jonah 2:2',
        lesson: 'No matter how far we run, God always loves us and waits for us to come back!'
      }
    ]
  },

  // ---- MOSES PARTS THE RED SEA ----
  moses_sea: {
    id: 'moses_sea',
    title: 'Moses and the Red Sea',
    icon: '🌊',
    bgColor: 'linear-gradient(180deg, #1a4a6e 0%, #0a1a2e 100%)',
    verse: '"The Lord will fight for you; you need only be still." — Exodus 14:14',
    lesson: 'When we trust God, He opens the way!',
    pages: [
      {
        id: 'p1',
        art: '🔥🌿',
        text: 'God spoke to Moses from a burning bush: "Go tell Pharaoh to let My people go!" Moses obeyed. Finally Pharaoh let them go — but then sent his whole army to chase them!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: 'The big Red Sea was in front of them and the army was right behind! Everyone was scared. What should Moses tell the people?',
        choices: [
          { text: '🙏 Trust God — He will make a way!', next: 'p3_trust' },
          { text: '😨 Be scared and give up', next: 'p3_scared' }
        ]
      },
      {
        id: 'p3_trust',
        art: '🌊🌊',
        text: 'Moses said, "Do not be afraid — God will fight for you!" He held up his stick and God split the whole sea in two! Count the walls of water!',
        miniGame: { type: 'count', target: 2, item: '🌊', prompt: 'Count the 2 walls of water!' },
        next: 'p4'
      },
      {
        id: 'p3_scared',
        art: '🌊🌊',
        text: 'Moses said, "God WILL save us!" He held up his stick and the whole sea split apart! Count the walls of water!',
        miniGame: { type: 'count', target: 2, item: '🌊', prompt: 'Count the 2 walls of water!' },
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🌈🎉',
        text: 'Everyone walked through on DRY ground! Then the water closed back up. God\'s people danced and sang: "God saved us! He is AMAZING!" When there is no way, God makes a way!',
        isEnd: true,
        verse: '"The Lord will fight for you; you need only be still." — Exodus 14:14',
        lesson: 'When there is no way, God makes a way! Trust Him with all your heart.'
      }
    ]
  },

  // ---- JESUS FEEDS 5,000 ----
  feeding_5000: {
    id: 'feeding_5000',
    title: 'Jesus Feeds Everyone!',
    icon: '🍞',
    bgColor: 'linear-gradient(180deg, #5a3a1a 0%, #2d1a08 100%)',
    verse: '"Jesus said: I am the bread of life." — John 6:35',
    lesson: 'With Jesus, even a little becomes a lot!',
    pages: [
      {
        id: 'p1',
        art: '👥',
        text: 'Thousands of people listened to Jesus all day. When evening came, everyone was SO hungry! A small boy had his lunch — just 5 loaves of bread and 2 little fish.',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: 'Should the little boy share his tiny lunch with thousands and thousands of people?',
        choices: [
          { text: '🤲 Share the lunch with Jesus!', next: 'p3_share' },
          { text: '🙈 Keep it — it is too small', next: 'p3_keep' }
        ]
      },
      {
        id: 'p3_share',
        art: '🍞🐟',
        text: 'The boy shared his lunch! Jesus thanked God and started breaking the bread — and it NEVER ran out! Help count the loaves!',
        miniGame: { type: 'count', target: 5, item: '🍞', prompt: 'Count 5 loaves of bread!' },
        next: 'p4'
      },
      {
        id: 'p3_keep',
        art: '🍞🐟',
        text: 'Jesus smiled: "Bring it to me." He thanked God and started breaking the bread — and it NEVER ran out! Help count the loaves!',
        miniGame: { type: 'count', target: 5, item: '🍞', prompt: 'Count 5 loaves of bread!' },
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🧺',
        text: 'Everyone ate until they were FULL! Afterward there were 12 whole baskets of leftovers. Jesus fed 5,000 people with one small lunch. With Jesus, a little becomes a LOT!',
        isEnd: true,
        verse: '"Jesus said: I am the bread of life." — John 6:35',
        lesson: 'When we give what we have to Jesus — even if it is small — He can do AMAZING things with it!'
      }
    ]
  },

  // ---- THE GOOD SAMARITAN ----
  good_samaritan: {
    id: 'good_samaritan',
    title: 'The Kind Helper',
    icon: '🤝',
    bgColor: 'linear-gradient(180deg, #5a3a00 0%, #2a1a00 100%)',
    verse: '"Love your neighbor as yourself." — Luke 10:27',
    lesson: 'Being kind to everyone is what God wants!',
    pages: [
      {
        id: 'p1',
        art: '🏃',
        text: 'A man got hurt by robbers and lay on the road needing help. A priest walked by and saw him — but kept right on walking. That was not very kind!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: 'Another man came down the road and saw the hurt man lying there. What do you think he should do?',
        choices: [
          { text: '🏥 Stop and help him!', next: 'p3_help' },
          { text: '🚶 Keep walking and ignore him', next: 'p3_ignore' }
        ]
      },
      {
        id: 'p3_help',
        art: '💙',
        text: 'The Good Samaritan jumped off his donkey! He bandaged the man\'s wounds, put him on his donkey, and brought him to an inn to rest and get better.',
        next: 'p4'
      },
      {
        id: 'p3_ignore',
        art: '🤗',
        text: 'Jesus says we should ALWAYS help! The Good Samaritan stopped right away, bandaged the wounds, and brought the hurt man to an inn to get better.',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '❤️',
        text: 'Jesus asked, "Who was a good neighbor?" The kind one! Jesus says: go and do the same — be kind to EVERYONE who needs your help.',
        isEnd: true,
        verse: '"Love your neighbor as yourself." — Luke 10:27',
        lesson: 'Your neighbor is EVERYONE who needs help. God loves it when we are kind!'
      }
    ]
  },

  // ---- BABY JESUS IS BORN ----
  baby_jesus: {
    id: 'baby_jesus',
    title: 'Baby Jesus is Born!',
    icon: '⭐',
    bgColor: 'linear-gradient(180deg, #0d0d2e 0%, #050510 100%)',
    verse: '"For God so loved the world that He gave His only Son." — John 3:16',
    lesson: 'Jesus came to earth because God loves us so much!',
    pages: [
      {
        id: 'p1',
        art: '👼',
        text: 'An angel told Mary: "You will have God\'s own Son — name Him Jesus!" Mary and Joseph traveled to Bethlehem, but every inn was full. They slept in a stable with animals!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '✨',
        text: 'That night baby Jesus was born — the most special baby in the whole world! A big bright star lit up the sky. Count the shining stars!',
        miniGame: { type: 'count', target: 5, item: '⭐', prompt: 'Count 5 shining stars!' },
        next: 'p3'
      },
      {
        id: 'p3',
        art: '🐑👨‍🌾',
        text: 'Angels sang to shepherds: "Glory to God! Peace on earth!" The shepherds RAN to see baby Jesus. Wise men followed the star and brought gifts and worshipped Him!',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '💝',
        text: 'Jesus was born in a small stable — but He was the greatest gift ever! God sent His Son because He loves YOU so very, very much!',
        isEnd: true,
        verse: '"For God so loved the world that He gave His only Son." — John 3:16',
        lesson: 'Jesus is God\'s greatest gift to us. He came because God loves you MORE than anything!'
      }
    ]
  },

  // ---- ZACCHAEUS ----
  zacchaeus: {
    id: 'zacchaeus',
    title: 'Zacchaeus in the Tree',
    icon: '🌳',
    bgColor: 'linear-gradient(180deg, #1a3a1a 0%, #0a1a0a 100%)',
    verse: '"For the Son of Man came to seek and save the lost." — Luke 19:10',
    lesson: 'Jesus loves everyone — even people who have made mistakes!',
    pages: [
      {
        id: 'p1',
        art: '🌳',
        text: 'Zacchaeus was a short little man who had not been very kind to people. When Jesus came to town, Zacchaeus could not see over the crowd — so he climbed a big tree!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '👀',
        text: 'Jesus walked right under the tree and looked UP: "Zacchaeus! Come down! I am coming to YOUR house today!" What do you think Zacchaeus felt?',
        choices: [
          { text: '😄 So happy Jesus noticed him!', next: 'p3_happy' },
          { text: '😲 Very surprised!', next: 'p3_surprised' }
        ]
      },
      {
        id: 'p3_happy',
        art: '🙌',
        text: 'Zacchaeus slid down as fast as he could — SO happy! Jesus cared about HIM, even though he had done wrong things before. Jesus always sees YOU!',
        next: 'p4'
      },
      {
        id: 'p3_surprised',
        art: '😮',
        text: 'Out of the WHOLE crowd, Jesus called his name! Zacchaeus scrambled down the tree as fast as he could. He could not believe Jesus noticed him!',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🏠❤️',
        text: 'Zacchaeus said, "Jesus, I will give back everything I took — and MORE!" Jesus smiled: "Salvation has come to this house today!" Jesus changes hearts!',
        isEnd: true,
        verse: '"For the Son of Man came to seek and save the lost." — Luke 19:10',
        lesson: 'No matter what you have done, Jesus loves you and wants to be your friend! He changes hearts.'
      }
    ]
  },

  // ---- JOSEPH AND HIS COLORFUL COAT ----
  joseph_coat: {
    id: 'joseph_coat',
    title: "Joseph's Colorful Coat",
    icon: '🎨',
    bgColor: 'linear-gradient(180deg, #3a1a5a 0%, #1a0a2e 100%)',
    verse: '"You intended to harm me, but God intended it for good." — Genesis 50:20',
    lesson: 'God has a good plan even when bad things happen!',
    pages: [
      {
        id: 'p1',
        art: '👨‍👦',
        text: 'Joseph\'s father gave him a beautiful coat with MANY bright colors! His brothers were jealous. Count the colors!',
        miniGame: { type: 'count', target: 4, item: '🎨', prompt: 'Count 4 colors in the coat!' },
        next: 'p2'
      },
      {
        id: 'p2',
        art: '😢',
        text: 'The brothers\' jealousy turned mean — they sold Joseph to traders going to Egypt! Joseph was very sad. But God was with him every step of the way.',
        next: 'p3'
      },
      {
        id: 'p3',
        art: '👑',
        text: 'In Egypt, God gave Joseph the gift of understanding dreams! Pharaoh made him second in charge of ALL Egypt. When his hungry brothers came for food, Joseph FORGAVE them and hugged them!',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🤗',
        text: '"Do not be sad — GOD sent me here to save your lives!" What looked terrible was actually God\'s wonderful plan all along. God turns bad things into GOOD!',
        isEnd: true,
        verse: '"You intended to harm me, but God intended it for good." — Genesis 50:20',
        lesson: 'Even when bad things happen, God has a plan to turn them into something GOOD!'
      }
    ]
  },

  // ---- QUEEN ESTHER ----
  esther: {
    id: 'esther',
    title: "Queen Esther's Courage",
    icon: '👸',
    bgColor: 'linear-gradient(180deg, #5a0a2e 0%, #2e0a18 100%)',
    verse: '"Who knows? Maybe you were made queen for such a time as this!" — Esther 4:14',
    lesson: 'God puts us exactly where we need to be — be brave!',
    pages: [
      {
        id: 'p1',
        art: '😡',
        text: 'Esther was a kind queen who loved God. A mean man named Haman made a terrible plan to hurt all of God\'s people! Esther\'s cousin begged her: "You must help us!"',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: 'Going to the king without being invited was very dangerous. But God\'s people needed her! Should Esther be brave?',
        choices: [
          { text: '💪 Yes! Be brave for God\'s people!', next: 'p3_brave' },
          { text: '😰 It is too scary...', next: 'p3_scared' }
        ]
      },
      {
        id: 'p3_brave',
        art: '👑',
        text: 'Esther said, "I will go — even if it is dangerous!" She prayed hard for 3 days. Then she walked in — and the king SMILED and welcomed her! God had gone before her.',
        next: 'p4'
      },
      {
        id: 'p3_scared',
        art: '🙏',
        text: '"Maybe God made you queen for THIS exact moment!" Esther prayed hard and chose to be brave. She walked in and the king smiled and welcomed her!',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🎉',
        text: 'Esther told the king about Haman\'s evil plan. The king stopped it! All of God\'s people were SAFE and the whole kingdom celebrated with a huge feast!',
        isEnd: true,
        verse: '"Who knows? Maybe you were made queen for such a time as this!" — Esther 4:14',
        lesson: 'God puts you exactly where you need to be. When you are brave and trust God, He uses YOU to do great things!'
      }
    ]
  },

  // ---- JESUS WALKS ON WATER ----
  jesus_water: {
    id: 'jesus_water',
    title: 'Walking on the Water',
    icon: '🌊',
    bgColor: 'linear-gradient(180deg, #0a2a4a 0%, #05101e 100%)',
    verse: '"Do not be afraid — take courage! I am here!" — Matthew 14:27',
    lesson: 'Keep your eyes on Jesus and you will never sink!',
    pages: [
      {
        id: 'p1',
        art: '🌩️',
        text: 'Jesus\' friends were in a boat when a HUGE storm came! They were very scared. Then in the dark they saw someone walking ON TOP of the water toward them!',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '🤔',
        text: '"It is Me — Jesus! Do not be afraid!" Peter said, "Tell me to come walk on the water too!" Jesus said, "Come!" What do you think Peter did?',
        choices: [
          { text: '🚶 Step out of the boat!', next: 'p3_step' },
          { text: '😰 Stay in the boat where it is safe', next: 'p3_stay' }
        ]
      },
      {
        id: 'p3_step',
        art: '🌟',
        text: 'Peter stepped out — and walked ON the water! Amazing! But he looked at the big waves and got scared. He started to sink! "Help, Lord!" Jesus caught him right away.',
        next: 'p4'
      },
      {
        id: 'p3_stay',
        art: '💪',
        text: 'Peter was SO brave — he stepped right out and walked on the water! But when he looked at the waves instead of Jesus, he started to sink. Jesus reached out and caught him!',
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🌅',
        text: 'Jesus helped Peter back into the boat and the storm stopped COMPLETELY! Everyone worshipped Jesus saying, "You truly ARE the Son of God!"',
        isEnd: true,
        verse: '"Do not be afraid — take courage! I am here!" — Matthew 14:27',
        lesson: 'When we keep our eyes on Jesus and trust Him, we can do impossible things! Do not look at the waves — look at Jesus!'
      }
    ]
  },

  // ---- LAZARUS ----
  lazarus: {
    id: 'lazarus',
    title: 'Jesus Raises Lazarus',
    icon: '🌸',
    bgColor: 'linear-gradient(180deg, #2a4a1a 0%, #101e08 100%)',
    verse: '"I am the resurrection and the life." — John 11:25',
    lesson: 'Jesus has power over everything — even death!',
    pages: [
      {
        id: 'p1',
        art: '😢',
        text: 'Jesus\' dear friend Lazarus got very sick and passed away. His sisters Mary and Martha cried and cried. When Jesus finally arrived, Lazarus had been gone for 4 whole days.',
        next: 'p2'
      },
      {
        id: 'p2',
        art: '😭',
        text: 'Jesus saw everyone crying — and He cried too! Even knowing what was about to happen, He felt their sadness. Jesus cares so much about our feelings.',
        next: 'p3'
      },
      {
        id: 'p3',
        art: '⚡',
        text: 'Jesus went to the tomb and said, "Roll the stone away!" He prayed, then called out in a LOUD voice: "LAZARUS — COME OUT!" Count the 4 days Lazarus was in the tomb!',
        miniGame: { type: 'count', target: 4, item: '🌸', prompt: 'Count 4 days Lazarus was in the tomb!' },
        next: 'p4'
      },
      {
        id: 'p4',
        art: '🎉',
        text: 'Lazarus walked right out — ALIVE! Mary and Martha hugged him tight with happy tears! Jesus said, "I am the resurrection and the life!" Nothing is impossible with God!',
        isEnd: true,
        verse: '"I am the resurrection and the life." — John 11:25',
        lesson: 'Jesus has power over EVERYTHING — even death! With God, nothing is impossible!'
      }
    ]
  }

};

// Story order for the selection screen
const STORY_ORDER = [
  'david_goliath', 'noahs_ark', 'daniel_lions', 'lost_sheep', 'creation',
  'baby_jesus', 'jonah_fish', 'moses_sea', 'feeding_5000', 'good_samaritan',
  'zacchaeus', 'joseph_coat', 'esther', 'jesus_water', 'lazarus'
];
