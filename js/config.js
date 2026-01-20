// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION — Edit this section to customize your dashboard
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Your location (for globe marker)
    location: {
        lat: 42.98,
        lon: -81.25,
        name: "London, ON"
    },

    // Daily intentions — reset these each morning
    daily: [
        "Morning workout",
        "Review lecture notes",
        "Work on project proposal",
        "Call mom",
        "Read for 30 minutes"
    ],

    // Mid-term goals — weeks to months
    midTerm: [
        "Finish capstone project",
        "Prepare for finals",
        "Update resume"
    ],

    // Long-term goals — months to years
    longTerm: [
        "Graduate with honors",
        "Land dream job",
        "Build personal project portfolio"
    ],

    // Today's schedule
    // type: "work" | "school" | "physical"
    schedule: [
        { time: "06:00", duration: 60, title: "Morning Workout", type: "physical" },
        { time: "08:00", duration: 30, title: "Breakfast & Review", type: "work" },
        { time: "09:00", duration: 90, title: "ECE 101 Lecture", type: "school" },
        { time: "11:00", duration: 60, title: "Study Session", type: "school" },
        { time: "12:00", duration: 60, title: "Lunch Break", type: "physical" },
        { time: "13:00", duration: 120, title: "Project Work", type: "work" },
        { time: "15:30", duration: 90, title: "ECE 202 Lab", type: "school" },
        { time: "17:30", duration: 60, title: "Gym", type: "physical" },
        { time: "19:00", duration: 60, title: "Dinner", type: "physical" },
        { time: "20:00", duration: 120, title: "Evening Study", type: "school" }
    ],

    // Timer presets in minutes
    timerPresets: [5, 10, 15, 25]
};

// ═══════════════════════════════════════════════════════════════════════════════
// END CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
