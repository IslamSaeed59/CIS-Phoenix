import type { CategoryId } from './categories';

export interface Discovery {
  icon: string; // emoji shown in the animated badge
  title: string;
  fact: string; // one or two short sentences
  question: string;
  answers: { text: string; correct: boolean }[];
  anim: 'salt' | 'water' | 'microbe' | 'heat' | 'wind' | 'map' | 'sand' | 'radar' | 'crater' | 'arm' | 'scan' | 'air' | 'pit';
}

export const EARTH_DISCOVERIES: Record<CategoryId, Discovery> = {
  geology: {
    icon: '🧂', title: 'Salt polygons!', anim: 'salt',
    fact: 'These white ridges are salt left behind when water dried up. Mars has salt deposits too.',
    question: 'What made this salt crust?',
    answers: [{ text: 'Water evaporating', correct: true }, { text: 'Lava from a volcano', correct: false }, { text: 'Snow', correct: false }],
  },
  water: {
    icon: '💧', title: 'A clue about water', anim: 'water',
    fact: 'Salt forms when salty water evaporates. On Mars, salts are a clue that water was there long ago.',
    question: 'Is there a lake here today?',
    answers: [{ text: 'No — but water was here in the past', correct: true }, { text: 'Yes, a big lake', correct: false }],
  },
  biology: {
    icon: '🦠', title: 'Life in extreme places', anim: 'microbe',
    fact: 'Tiny microbes can live inside salt on Earth. Scientists wonder: could Mars salts have hosted life long ago?',
    question: 'Do microbes in Qaidam prove there is life on Mars?',
    answers: [{ text: 'No — it only gives ideas to test', correct: true }, { text: 'Yes, definitely', correct: false }],
  },
  temperature: {
    icon: '🌡️', title: 'Hot and cold ground', anim: 'heat',
    fact: 'Dark rocks absorb more sunlight and get hotter than white salt. Mars can swing from about +20 °C to −100 °C in one day!',
    question: 'Why is the dark gravel hotter?',
    answers: [{ text: 'It absorbs more sunlight', correct: true }, { text: 'It is closer to the Sun', correct: false }],
  },
  dust: {
    icon: '🌬️', title: 'Carved by wind', anim: 'wind',
    fact: 'Yardangs are ridges carved by wind and sand over thousands of years. Mars has yardangs too!',
    question: 'What carved these ridges?',
    answers: [{ text: 'Wind and sand', correct: true }, { text: 'Rivers', correct: false }],
  },
  terrain: {
    icon: '🗺️', title: 'A 3D map', anim: 'map',
    fact: 'A 3D scan shows which slopes are too steep. Rover drivers use maps like this to plan safe routes.',
    question: 'Why map slopes before driving a rover?',
    answers: [{ text: 'To find a safe route', correct: true }, { text: 'Just for fun', correct: false }],
  },
  operations: {
    icon: '🥾', title: 'Soft sand!', anim: 'sand',
    fact: 'The probe sank deep into the sand. NASA’s Spirit rover got stuck in soft soil on Mars in 2009.',
    question: 'Which ground is safer for a rover?',
    answers: [{ text: 'Hard salt crust', correct: true }, { text: 'Soft sand', correct: false }],
  },
  subsurface: {
    icon: '📡', title: 'Seeing underground', anim: 'radar',
    fact: 'Radar sees layers under the ground without digging. The Perseverance rover carries a radar like this on Mars.',
    question: 'What does ground radar show?',
    answers: [{ text: 'Layers under the surface', correct: true }, { text: 'Underground animals', correct: false }],
  },
};

export const MARS_DISCOVERIES: Record<CategoryId, Discovery> = {
  terrain: {
    icon: '☄️', title: 'An impact crater', anim: 'crater',
    fact: 'Craters form when space rocks hit the ground. Mars keeps many more old craters than Earth, where rain and plants erase them.',
    question: 'What made this crater?',
    answers: [{ text: 'A space rock impact', correct: true }, { text: 'A volcano', correct: false }],
  },
  dust: {
    icon: '🌬️', title: 'Mars ripples', anim: 'wind',
    fact: 'Wind builds ripples on Mars just like in Qaidam — but Mars air is about 100 times thinner.',
    question: 'Same shapes on Earth and Mars means…',
    answers: [{ text: 'A similar process (wind) made them', correct: true }, { text: 'The places are identical', correct: false }],
  },
  temperature: {
    icon: '🥶', title: 'Freezing planet', anim: 'heat',
    fact: 'Sand heats up and cools down fast. Mars is much colder than Earth — about −60 °C on average.',
    question: 'Compared with Qaidam, Mars is…',
    answers: [{ text: 'Much colder', correct: true }, { text: 'Hotter', correct: false }],
  },
  operations: {
    icon: '🛞', title: 'Rescued!', anim: 'sand',
    fact: 'You backed out slowly — just like real rover drivers. Lessons from Qaidam’s soft sand saved the rover.',
    question: 'Best way out of soft sand?',
    answers: [{ text: 'Reverse slowly', correct: true }, { text: 'Push forward at full speed', correct: false }],
  },
  geology: {
    icon: '🦾', title: 'Rock chemistry', anim: 'arm',
    fact: 'The arm found sulfur and calcium — signs of salty minerals, a bit like Qaidam’s salt crust.',
    question: 'What does this suggest?',
    answers: [{ text: 'Water may have been here long ago', correct: true }, { text: 'There is a lake here today', correct: false }],
  },
  water: {
    icon: '🌈', title: 'Colour clues', anim: 'scan',
    fact: 'Special colour images can spot minerals that formed with water. But one scan is not proof.',
    question: 'How sure are we after one scan?',
    answers: [{ text: 'Not sure yet — more tests needed', correct: true }, { text: '100% sure', correct: false }],
  },
  biology: {
    icon: '☀️', title: 'Harsh air', anim: 'air',
    fact: 'Mars air is very thin, very dry and full of UV light. That makes life on the surface today very hard.',
    question: 'Did we find life on Mars?',
    answers: [{ text: 'No signs yet — still unknown', correct: true }, { text: 'Yes!', correct: false }],
  },
  subsurface: {
    icon: '🕳️', title: 'A mysterious pit', anim: 'pit',
    fact: 'Pits like this might lead to caves. One day caves could shelter astronauts from radiation.',
    question: 'Is this pit proven to be a cave?',
    answers: [{ text: 'No — it is only a candidate', correct: true }, { text: 'Yes', correct: false }],
  },
};
