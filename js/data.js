/* StudySnap — mock data. All content here is static demo data; no backend calls. */
(function () {
  "use strict";

  window.MOCK = {
    subjects: {
      Math:      { color: "#2563EB", bg: "rgba(37, 99, 235, 0.12)" },
      Physics:   { color: "#7C3AED", bg: "rgba(124, 58, 237, 0.12)" },
      Chemistry: { color: "#DB2777", bg: "rgba(219, 39, 119, 0.12)" },
      English:   { color: "#16A34A", bg: "rgba(22, 163, 74, 0.12)" },
      History:   { color: "#D97706", bg: "rgba(217, 119, 6, 0.14)" }
    },

    tasks: [
      {
        id: "t1",
        title: "Algebra worksheet — equations 1–12",
        subject: "Math",
        due: "Today",
        dueDate: "Jun 11",
        priority: "high",
        estMinutes: 40,
        completed: false,
        source: "Scanned from worksheet photo",
        description:
          "Solve the twelve linear equations on the worksheet. Show every step — Ms. Alvarez takes points off for skipped work. Questions 9–12 are two-step equations with fractions.",
        subtasks: [
          { label: "Questions 1–4 (one-step)", done: true },
          { label: "Questions 5–8 (two-step)", done: true },
          { label: "Questions 9–12 (fractions)", done: false },
          { label: "Check answers against the back of the book", done: false }
        ]
      },
      {
        id: "t2",
        title: "Lab report: pendulum experiment",
        subject: "Physics",
        due: "Tomorrow",
        dueDate: "Jun 12",
        priority: "medium",
        estMinutes: 60,
        completed: false,
        source: "Scanned from lab handout",
        description:
          "Write up the pendulum period experiment. Include the data table from class, a graph of period vs. length, and a conclusion comparing results to T = 2π√(L/g).",
        subtasks: [
          { label: "Type up data table", done: true },
          { label: "Plot period vs. length graph", done: false },
          { label: "Write conclusion (½ page)", done: false }
        ]
      },
      {
        id: "t3",
        title: "Read ch. 4–5 of To Kill a Mockingbird",
        subject: "English",
        due: "Friday",
        dueDate: "Jun 13",
        priority: "low",
        estMinutes: 50,
        completed: false,
        source: "Added manually",
        description:
          "Read chapters 4 and 5 and jot down two discussion questions per chapter for Friday's seminar circle.",
        subtasks: [
          { label: "Chapter 4 + 2 questions", done: false },
          { label: "Chapter 5 + 2 questions", done: false }
        ]
      },
      {
        id: "t4",
        title: "Essay outline: causes of WWI",
        subject: "History",
        due: "Monday",
        dueDate: "Jun 16",
        priority: "medium",
        estMinutes: 45,
        completed: false,
        source: "Scanned from assignment sheet",
        description:
          "Draft a one-page outline covering the M.A.I.N. causes (Militarism, Alliances, Imperialism, Nationalism) with one primary-source example each.",
        subtasks: [
          { label: "Pick thesis angle", done: false },
          { label: "Find 4 primary-source examples", done: false },
          { label: "Outline intro + 3 body sections", done: false }
        ]
      },
      {
        id: "t5",
        title: "Balance chemical equations practice",
        subject: "Chemistry",
        due: "Done",
        dueDate: "Jun 10",
        priority: "low",
        estMinutes: 30,
        completed: true,
        source: "Scanned from textbook page",
        description: "Practice set 7.2, problems 1–10. Completed and checked in class.",
        subtasks: [
          { label: "Problems 1–10", done: true }
        ]
      }
    ],

    // Tasks "detected" by the mock homework scan in the upload section.
    detectedTasks: [
      {
        id: "d1",
        title: "Quiz prep: quadratic formula drill",
        subject: "Math",
        due: "Thursday",
        dueDate: "Jun 12",
        priority: "high",
        estMinutes: 35,
        completed: false,
        source: "Scanned just now",
        description:
          "Detected from your photo: quiz Thursday on the quadratic formula. Practice problems 1–8 on the review sheet.",
        subtasks: [
          { label: "Re-derive the formula once from ax² + bx + c = 0", done: false },
          { label: "Problems 1–8 on review sheet", done: false }
        ]
      },
      {
        id: "d2",
        title: "Vocabulary list: unit 9 (20 words)",
        subject: "English",
        due: "Friday",
        dueDate: "Jun 13",
        priority: "medium",
        estMinutes: 25,
        completed: false,
        source: "Scanned just now",
        description: "Detected from your photo: define and use each unit 9 word in a sentence.",
        subtasks: [
          { label: "Definitions 1–20", done: false },
          { label: "One sentence per word", done: false }
        ]
      },
      {
        id: "d3",
        title: "Worksheet: Newton's second law problems",
        subject: "Physics",
        due: "Monday",
        dueDate: "Jun 16",
        priority: "medium",
        estMinutes: 40,
        completed: false,
        source: "Scanned just now",
        description: "Detected from your photo: F = ma word problems, sheet 12, both sides.",
        subtasks: [
          { label: "Front side (1–6)", done: false },
          { label: "Back side (7–12)", done: false }
        ]
      }
    ],

    studyPlan: {
      headline: "Your plan for this afternoon",
      summary:
        "2 hr 5 min across 4 focus blocks. Math comes first — it's due today and you focus best before dinner.",
      blocks: [
        { time: "4:00 PM", title: "Algebra worksheet Q9–12", subject: "Math", minutes: 25, kind: "focus" },
        { time: "4:25 PM", title: "Stretch + water break", subject: null, minutes: 5, kind: "break" },
        { time: "4:30 PM", title: "Pendulum graph + conclusion", subject: "Physics", minutes: 25, kind: "focus" },
        { time: "4:55 PM", title: "Snack break", subject: null, minutes: 10, kind: "break" },
        { time: "5:05 PM", title: "Read Mockingbird ch. 4", subject: "English", minutes: 30, kind: "focus" },
        { time: "5:35 PM", title: "Quadratic formula flashcards", subject: "Math", minutes: 15, kind: "review" }
      ],
      reasons: [
        "Math worksheet is due today, so it gets your freshest energy",
        "Physics lab report is 60 min total — splitting it over two days keeps blocks short",
        "Reading goes last: it's lighter and works fine when you're a bit tired"
      ]
    },

    aiExplanations: {
      t1: {
        problem: "Solve for x:  2x + 5 = 17",
        subject: "Math",
        topic: "Linear equations",
        confidence: "Matched to problem 7 on your scanned algebra worksheet.",
        steps: [
          {
            title: "Get the variable term alone",
            body: "Undo the \"+5\" by subtracting 5 from both sides. Whatever you do to one side you must do to the other to keep the equation balanced.",
            math: "2x + 5 − 5 = 17 − 5   →   2x = 12"
          },
          {
            title: "Undo the multiplication",
            body: "x is being multiplied by 2, so divide both sides by 2 to isolate x.",
            math: "2x ÷ 2 = 12 ÷ 2   →   x = 6"
          },
          {
            title: "Check your answer",
            body: "Substitute x = 6 back into the original equation. Both sides must match.",
            math: "2(6) + 5 = 12 + 5 = 17 ✓"
          }
        ],
        answer: "x = 6",
        concepts: ["Inverse operations", "Balancing equations", "Substitution check"]
      },
      t2: {
        problem: "T = 2π√(L/g) — how does pendulum period change with length?",
        subject: "Physics",
        topic: "Simple harmonic motion",
        confidence: "Matched to the formula in your pendulum lab report.",
        steps: [
          {
            title: "Understand the variables",
            body: "T is the period (time for one full swing), L is the pendulum length, and g ≈ 9.8 m/s² is gravitational acceleration. Notice: mass and swing height don't appear — they don't affect period.",
            math: "T = 2π√(L/g)"
          },
          {
            title: "Predict how T scales with L",
            body: "Because of the square root, quadrupling L only doubles T. Doubling L multiplies T by √2 ≈ 1.41.",
            math: "T₂ / T₁ = √(L₂ / L₁)   →   if L₂ = 2L₁, then T₂ = √2 · T₁"
          },
          {
            title: "Verify with your graph",
            body: "Plot T² on the y-axis vs. L on the x-axis. A straight line through the origin confirms the relationship. The slope equals 4π²/g.",
            math: "T² = (4π²/g) · L   →   slope ≈ 4.03 s²/m"
          }
        ],
        answer: "Quadrupling length doubles the period.",
        concepts: ["Square-root scaling", "Period vs. length graph", "Slope analysis"]
      },
      t3: {
        problem: "How does Scout's perspective shape what readers understand in ch. 4–5?",
        subject: "English",
        topic: "Narrative perspective",
        confidence: "Matched to your To Kill a Mockingbird reading assignment.",
        steps: [
          {
            title: "Identify the narrator's position",
            body: "Scout narrates as an adult looking back on childhood events. This 'double vision' lets Lee show both childlike confusion and adult understanding at the same time.",
            math: "Narrator = adult Scout ≠ character = child Scout"
          },
          {
            title: "Find the dramatic irony in ch. 4",
            body: "When Scout and Jem find gifts in the knothole, Scout doesn't know who left them — but readers start to suspect Boo Radley. Her limited understanding is exactly the point.",
            math: "Reader's inference > Scout's understanding = dramatic irony"
          },
          {
            title: "Turn this into a discussion question",
            body: "The strongest questions connect perspective to a larger theme. Ask what Scout's innocence reveals about the adults around her — and what she can't yet name.",
            math: "Good Q: 'What does Scout miss that we notice?'"
          }
        ],
        answer: "Scout's child perspective creates dramatic irony — readers see more than she does.",
        concepts: ["Unreliable narrator", "Dramatic irony", "Coming-of-age theme"]
      },
      t4: {
        problem: "What are the M.A.I.N. causes of WWI and how do they connect?",
        subject: "History",
        topic: "Causation & primary sources",
        confidence: "Matched to your WWI essay outline assignment.",
        steps: [
          {
            title: "Break down the acronym",
            body: "M.A.I.N. stands for Militarism, Alliances, Imperialism, Nationalism. These are structural causes — the kindling that made war possible before the spark (Franz Ferdinand's assassination).",
            math: "M + A + I + N = conditions for war; spark = trigger"
          },
          {
            title: "Link the causes to each other",
            body: "Imperialism created rivalries (M), those rivalries fueled military build-ups (M), alliances turned a local conflict into a world war (A), and nationalism made populations willing to fight (N).",
            math: "I → M → A → escalation; N → mass mobilization"
          },
          {
            title: "Pick a primary source for each",
            body: "For your outline you need one source per cause. Examples: Schlieffen Plan (Militarism), Triple Entente treaty text (Alliances), a colonial map (Imperialism), a nationalist newspaper headline (Nationalism).",
            math: "1 cause = 1 thesis point + 1 primary source"
          }
        ],
        answer: "The four causes interlocked: imperialism and militarism set the stage; alliances widened the war; nationalism sustained it.",
        concepts: ["Structural vs. immediate causes", "Primary source analysis", "Thesis construction"]
      }
    },

    resources: [
      {
        type: "video",
        title: "Two-step equations in 8 minutes",
        source: "Khan Academy",
        meta: "8 min video",
        subject: "Math",
        rating: 4.9
      },
      {
        type: "practice",
        title: "Linear equations practice set (24 problems)",
        source: "IXL",
        meta: "Adaptive practice",
        subject: "Math",
        rating: 4.7
      },
      {
        type: "video",
        title: "The simple pendulum, explained visually",
        source: "Physics Girl",
        meta: "11 min video",
        subject: "Physics",
        rating: 4.8
      },
      {
        type: "article",
        title: "How to write a lab conclusion that gets full marks",
        source: "Science Buddies",
        meta: "6 min read",
        subject: "Physics",
        rating: 4.6
      },
      {
        type: "flashcards",
        title: "To Kill a Mockingbird — characters & themes",
        source: "Quizlet",
        meta: "42 cards",
        subject: "English",
        rating: 4.5
      },
      {
        type: "article",
        title: "M.A.I.N. causes of WWI with primary sources",
        source: "Crash Course Notes",
        meta: "9 min read",
        subject: "History",
        rating: 4.7
      }
    ]
  };
})();
