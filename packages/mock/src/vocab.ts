/**
 * Hand-written, neutral topics: home organisation and small facts about everyday objects.
 * No health, finance or legal topics. Every "fact" is mock content with an example.com source.
 */

export interface TopicVocab {
  id: string;
  title: string;
  niche: string;
  /** Scene 1: narration and the text on the first frame (max 8 words). */
  hook: string;
  firstFrame: string;
  /** Scenes 2 and 3: one fact each. */
  facts: [FactVocab, FactVocab];
  /** Scene 2 overlay. */
  label: { heading: string; value: string };
  /** Series 2 ("Myth or fact"): scene 3 becomes a quiz card. */
  quiz?: { options: [string, string]; answer: 0 | 1 };
  /** Scene 5: the question to the viewer. */
  question: string;
}

export interface FactVocab {
  id: string;
  /** Fact as written in the card. */
  text: string;
  /** How the narrator says it. */
  line: string;
  onScreen: string;
}

export const TOPICS: TopicVocab[] = [
  {
    id: "drawer-dividers-from-boxes",
    title: "Drawer dividers from old shoe boxes",
    niche: "home-organisation",
    hook: "Your junk drawer needs walls, not a new drawer.",
    firstFrame: "Junk drawer fix for free",
    facts: [
      { id: "lids_as_trays", text: "Shoe box lids work as shallow trays for small items.", line: "Cut the lids off your old shoe boxes. They make shallow trays for batteries and keys.", onScreen: "Lids become trays" },
      { id: "cut_to_height", text: "Box sides can be cut down to the drawer height.", line: "Trim the sides to the height of the drawer, so it still closes without a fight.", onScreen: "Trim to drawer height" },
    ],
    label: { heading: "Cost:", value: "zero" },
    question: "What lives in your junk drawer right now?",
  },
  {
    id: "socks-folded-in-thirds",
    title: "Fold socks in thirds, not in balls",
    niche: "home-organisation",
    hook: "Rolling socks into balls is why the drawer never closes.",
    firstFrame: "Stop balling your socks",
    facts: [
      { id: "balls_stretch", text: "Balled socks keep the cuff stretched while stored.", line: "A sock ball keeps the cuff pulled tight the whole time it sits in the drawer.", onScreen: "Balls stretch the cuff" },
      { id: "thirds_stand_up", text: "Socks folded in thirds can stand upright in a drawer.", line: "Fold each pair in thirds and stand it up. You see every pair at once.", onScreen: "Fold in thirds, stand up" },
    ],
    label: { heading: "Time:", value: "10 seconds a pair" },
    quiz: { options: ["Balls save space", "Upright saves space"], answer: 1 },
    question: "Team balls or team thirds?",
  },
  {
    id: "freezer-labels-with-tape",
    title: "Label freezer bags before you fill them",
    niche: "kitchen",
    hook: "Writing on a full freezer bag never works.",
    firstFrame: "Label the bag first",
    facts: [
      { id: "flat_bag_writes", text: "A flat, dry bag is easier to write on than a full one.", line: "Write on the bag while it is flat and dry. The pen actually works.", onScreen: "Flat bag, clear writing" },
      { id: "date_and_name", text: "A label with the contents and the date makes the oldest food easy to find.", line: "Put the name and the date. Next month you will know what to eat first.", onScreen: "Name plus date" },
    ],
    label: { heading: "Write:", value: "name + date" },
    question: "What is the oldest thing in your freezer?",
  },
  {
    id: "bed-sheets-in-pillowcase",
    title: "Store each bed sheet set inside its own pillowcase",
    niche: "home-organisation",
    hook: "Stop digging for the matching sheet.",
    firstFrame: "One set, one pillowcase",
    facts: [
      { id: "set_in_case", text: "A folded sheet set fits inside one of its own pillowcases.", line: "Fold the sheets and slide the whole set into one of its pillowcases.", onScreen: "Sheets go inside" },
      { id: "one_grab", text: "Keeping a set together means one item to grab from the shelf.", line: "Now the shelf holds whole sets. You grab one bundle and you are done.", onScreen: "Grab one bundle" },
    ],
    label: { heading: "Shelf:", value: "one bundle per bed" },
    question: "How many sheet sets do you actually use?",
  },
  {
    id: "honey-never-spoils-myth",
    title: "Does honey really never go off?",
    niche: "kitchen-facts",
    hook: "You have heard that honey lasts forever.",
    firstFrame: "Honey lasts forever?",
    facts: [
      { id: "low_water", text: "Honey has very little water, which slows down spoiling.", line: "Honey holds very little water, and that makes spoiling slow.", onScreen: "Very little water" },
      { id: "keep_closed", text: "Honey left open can take in moisture from the air.", line: "But leave the jar open and it pulls in moisture from the air.", onScreen: "Keep the lid on" },
    ],
    label: { heading: "Store:", value: "closed jar" },
    quiz: { options: ["Lasts forever, no matter what", "Lasts long if kept closed"], answer: 1 },
    question: "Do you keep honey in the cupboard or the fridge?",
  },
  {
    id: "cable-ties-from-bread-clips",
    title: "Bread bag clips as cable labels",
    niche: "home-organisation",
    hook: "Every charger in the drawer looks the same.",
    firstFrame: "Which charger is which?",
    facts: [
      { id: "clip_fits", text: "A plastic bread bag clip fits around a standard charging cable.", line: "A bread bag clip snaps right around a charging cable and stays put.", onScreen: "Clip on the cable" },
      { id: "write_on_clip", text: "The flat side of the clip can be written on with a marker.", line: "Write the device name on the flat side with a marker.", onScreen: "Write the name" },
    ],
    label: { heading: "You need:", value: "clip + marker" },
    question: "How many mystery chargers do you have?",
  },
  {
    id: "towels-rolled-vs-folded",
    title: "Roll towels on open shelves, fold them in cupboards",
    niche: "home-organisation",
    hook: "Rolled or folded towels? It depends on the shelf.",
    firstFrame: "Roll or fold towels?",
    facts: [
      { id: "rolls_open_shelf", text: "Rolled towels sit neatly on open shelves and baskets.", line: "On open shelves and in baskets, rolls stay neat and you can pull one out easily.", onScreen: "Open shelf: roll" },
      { id: "folds_stack", text: "Folded towels stack flat and use the full depth of a cupboard.", line: "In a deep cupboard, flat folds stack higher and use the space better.", onScreen: "Cupboard: fold" },
    ],
    label: { heading: "Rule:", value: "shelf decides" },
    question: "Where do your towels live?",
  },
  {
    id: "spare-buttons-one-jar",
    title: "Why the spare buttons that come with a new coat are worth keeping in one small labelled jar on the hallway shelf",
    niche: "home-organisation",
    hook: "That tiny bag of spare buttons has a better home.",
    firstFrame: "Spare buttons, one jar",
    facts: [
      { id: "buttons_match", text: "Spare buttons sewn into a new coat match it exactly.", line: "The spare buttons from a new coat are an exact match, which is hard to find later.", onScreen: "Exact match" },
      { id: "one_jar", text: "Keeping all spare buttons in one jar makes them easy to find.", line: "Drop every spare button into one small jar. When one falls off, you know where to look.", onScreen: "One jar for all" },
    ],
    label: { heading: "Label:", value: "spare buttons" },
    quiz: { options: ["Throw them away", "Keep them in one jar"], answer: 1 },
    question: "Have you ever needed one of those spare buttons?",
  },
  {
    id: "fridge-door-warmest",
    title: "The fridge door is not the place for milk",
    niche: "kitchen-facts",
    hook: "The door is the busiest part of the fridge.",
    firstFrame: "Milk in the door?",
    facts: [
      { id: "door_warms", text: "The fridge door warms up every time the fridge is opened.", line: "Every time you open the fridge, the door shelves warm up first.", onScreen: "Door warms first" },
      { id: "door_for_sauces", text: "The door suits jars and sauces that handle small changes in temperature.", line: "Keep the door for jars and sauces. They handle the small changes better.", onScreen: "Door: jars and sauces" },
    ],
    label: { heading: "Door:", value: "sauces, not milk" },
    question: "What is in your fridge door right now?",
  },
  {
    id: "keys-hook-by-door",
    title: "One hook by the door ends the morning key hunt",
    niche: "home-organisation",
    hook: "The key hunt starts the day badly.",
    firstFrame: "One hook, no hunt",
    facts: [
      { id: "fixed_place", text: "Keeping an item in one fixed place makes it faster to find.", line: "Things with one fixed place are faster to find. Keys are no exception.", onScreen: "One fixed place" },
      { id: "by_the_door", text: "A hook next to the door is on the way in and out.", line: "Put the hook right by the door, where your hand already is when you come home.", onScreen: "Right by the door" },
    ],
    label: { heading: "Place:", value: "by the door" },
    question: "Where did you last lose your keys?",
  },
  {
    id: "cast-iron-soap-myth",
    title: "Can you wash a cast iron pan with soap?",
    niche: "kitchen-facts",
    hook: "Some say one drop of soap ruins a cast iron pan.",
    firstFrame: "Soap on cast iron?",
    facts: [
      { id: "mild_soap_ok", text: "A little mild dish soap does not remove a well-built seasoning layer.", line: "A little mild dish soap does not strip a good seasoning layer.", onScreen: "Mild soap is fine" },
      { id: "dry_right_away", text: "Drying the pan right after washing helps prevent rust.", line: "What matters more is drying the pan right away, so it does not rust.", onScreen: "Dry it right away" },
    ],
    label: { heading: "After washing:", value: "dry at once" },
    quiz: { options: ["Soap ruins it", "A little soap is fine"], answer: 1 },
    question: "Did you grow up with the no soap rule?",
  },
  {
    id: "batteries-in-a-box",
    title: "Keep loose batteries in a box, ends apart",
    niche: "home-organisation",
    hook: "Loose batteries rolling around a drawer is a small risk.",
    firstFrame: "Loose batteries? Box them",
    facts: [
      { id: "ends_touching", text: "Battery ends touching metal objects can make them run down.", line: "When battery ends touch keys or coins, they can slowly run down.", onScreen: "Ends away from metal" },
      { id: "box_by_size", text: "A small box with sections keeps batteries sorted by size.", line: "A small box with sections keeps them apart and sorted by size.", onScreen: "Sort by size" },
    ],
    label: { heading: "Store:", value: "box with sections" },
    question: "How many dead batteries are in your drawer?",
  },
  {
    id: "plant-water-finger-test",
    title: "The finger test for watering house plants",
    niche: "house-plants",
    hook: "Most house plants get too much water, not too little.",
    firstFrame: "Water less, check more",
    facts: [
      { id: "dry_top", text: "Many house plants only need water when the top layer of soil is dry.", line: "Many plants only need water when the top of the soil is dry.", onScreen: "Top soil dry?" },
      { id: "finger_depth", text: "Pushing a finger into the soil is a simple way to check moisture.", line: "Push a finger into the soil. Dry? Water it. Damp? Wait a few days.", onScreen: "Finger test" },
    ],
    label: { heading: "Check:", value: "one finger deep" },
    question: "Which plant of yours always looks sad?",
  },
  {
    id: "paper-clutter-one-tray",
    title: "One tray for paper that needs action",
    niche: "home-organisation",
    hook: "Paper piles grow because nothing has a place.",
    firstFrame: "One tray for paper",
    facts: [
      { id: "single_inbox", text: "A single tray for incoming paper keeps it in one place.", line: "Give every new letter one place to land: a single tray.", onScreen: "One landing spot" },
      { id: "weekly_clear", text: "Clearing the tray once a week keeps the pile small.", line: "Empty it once a week. The pile never gets the chance to grow.", onScreen: "Clear it weekly" },
    ],
    label: { heading: "Routine:", value: "once a week" },
    quiz: { options: ["More trays, more order", "One tray is enough"], answer: 1 },
    question: "When did you last see the bottom of your paper pile?",
  },
  {
    id: "shoe-rack-by-size",
    title: "Put everyday shoes at hand height",
    niche: "home-organisation",
    hook: "The shoes you wear daily should not live at the bottom.",
    firstFrame: "Daily shoes, top shelf",
    facts: [
      { id: "reach_zone", text: "Items at hand height are the quickest to reach.", line: "Things at hand height are the quickest to grab and put back.", onScreen: "Hand height wins" },
      { id: "rare_low", text: "Rarely used items can go on the lowest shelf.", line: "Boots you wear twice a year can go down low.", onScreen: "Rare shoes go low" },
    ],
    label: { heading: "Top:", value: "daily pairs" },
    question: "How many pairs do you really wear?",
  },
  {
    id: "spice-jars-labels-on-lids",
    title: "Label spice jars on the lid, not the side",
    niche: "kitchen",
    hook: "In a drawer, you only ever see the lids.",
    firstFrame: "Labels on the lids",
    facts: [
      { id: "lids_visible", text: "Jars stored in a drawer are seen from above.", line: "Jars in a drawer are seen from above, so side labels are hidden.", onScreen: "Seen from above" },
      { id: "alphabetical", text: "Sorting jars alphabetically makes one jar faster to find.", line: "Put the lid labels in alphabetical order and each spice takes a second to find.", onScreen: "A to Z" },
    ],
    label: { heading: "Order:", value: "A to Z" },
    question: "Drawer or rack for your spices?",
  },
  {
    id: "umbrella-dry-open",
    title: "Dry an umbrella open, but not in the sun",
    niche: "home-care",
    hook: "A closed wet umbrella starts to smell.",
    firstFrame: "Wet umbrella? Open it",
    facts: [
      { id: "open_dries", text: "An open umbrella dries faster than a closed one.", line: "Open it up after the rain. It dries much faster that way.", onScreen: "Open dries faster" },
      { id: "no_strong_sun", text: "Long strong sun can fade umbrella fabric.", line: "Just keep it out of strong sun for hours, or the fabric fades.", onScreen: "Shade, not sun" },
    ],
    label: { heading: "Dry:", value: "open, in the shade" },
    quiz: { options: ["Dry it closed", "Dry it open"], answer: 1 },
    question: "Where does your umbrella dry?",
  },
];

export interface ProductVocab {
  id: string;
  name: string;
  category: string;
  price: number;
  material: string;
  features: string[];
}

export const PRODUCTS: ProductVocab[] = [
  { id: "stackable-drawer-trays", name: "Stackable drawer trays, set of 4", category: "home-organisation", price: 39.99, material: "plastic", features: ["four sizes", "stackable"] },
  { id: "cable-clip-set", name: "Reusable cable clips, set of 12", category: "home-organisation", price: 19.5, material: "silicone", features: ["write-on surface", "12 colours"] },
];
