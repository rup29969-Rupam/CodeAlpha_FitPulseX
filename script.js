/**
 * FITPULSE X - Personal Activity & Habit Intelligence Dashboard
 * CodeAlpha App Development Internship - Task 3 (Fitness Tracker App)
 * Pure Vanilla JavaScript (ES6+) • LocalStorage Persistence • Zero External Libraries
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. STORAGE & STATE MANAGEMENT MODULE
     ========================================================================== */
  const STORAGE_KEY = 'fitpulsex_data_v1';

  const DefaultState = {
    version: '1.0.0',
    profile: {
      name: 'Alex Morgan',
      onboarded: false,
      createdAt: new Date().toISOString()
    },
    goals: {
      steps: 8000,
      water: 2500,
      activity: 45,
      sleep: 8.0
    },
    theme: 'dark',
    isDemo: false,
    days: {},
    streaks: {
      current: 0,
      longest: 0,
      lastEvaluatedDate: null
    },
    achievements: {}
  };

  const Store = {
    data: null,

    init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.data = JSON.parse(raw);
          // Merge defaults in case new fields were added
          this.data = Object.assign({}, DefaultState, this.data);
          this.data.goals = Object.assign({}, DefaultState.goals, this.data.goals || {});
          this.data.profile = Object.assign({}, DefaultState.profile, this.data.profile || {});
          this.data.streaks = Object.assign({}, DefaultState.streaks, this.data.streaks || {});
          this.data.achievements = this.data.achievements || {};
          this.data.days = this.data.days || {};
        } else {
          this.data = JSON.parse(JSON.stringify(DefaultState));
        }
      } catch (err) {
        console.warn('Error parsing LocalStorage, resetting to default:', err);
        this.data = JSON.parse(JSON.stringify(DefaultState));
      }
      this.ensureTodayRecord();
      this.save();
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.error('Error saving data to LocalStorage:', e);
      }
    },

    getTodayKey() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    ensureTodayRecord() {
      const key = this.getTodayKey();
      if (!this.data.days[key]) {
        this.data.days[key] = {
          steps: 0,
          water: 0,
          activity: 0,
          sleep: 0.0,
          activities: []
        };
      }
      return this.data.days[key];
    },

    getToday() {
      return this.ensureTodayRecord();
    },

    getDay(dateKey) {
      return this.data.days[dateKey] || {
        steps: 0,
        water: 0,
        activity: 0,
        sleep: 0.0,
        activities: []
      };
    },

    updateMetric(metric, deltaOrValue, isAbsolute = false) {
      const today = this.getToday();
      const num = Number(deltaOrValue);
      if (isNaN(num)) return;

      if (isAbsolute) {
        today[metric] = Math.max(0, num);
      } else {
        today[metric] = Math.max(0, (today[metric] || 0) + num);
      }

      this.save();
      FitPulseApp.onDataChanged();
    },

    addActivity(activity) {
      const today = this.getToday();
      if (!today.activities) today.activities = [];
      today.activities.unshift(activity);
      today.activity = (today.activity || 0) + activity.duration;
      this.save();
      FitPulseApp.onDataChanged();
    },

    deleteActivity(activityId) {
      const today = this.getToday();
      if (!today.activities) return;

      const idx = today.activities.findIndex(a => a.id === activityId);
      if (idx !== -1) {
        const removed = today.activities.splice(idx, 1)[0];
        today.activity = Math.max(0, (today.activity || 0) - removed.duration);
        this.save();
        FitPulseApp.onDataChanged();
      }
    },

    resetAll() {
      localStorage.removeItem(STORAGE_KEY);
      this.data = JSON.parse(JSON.stringify(DefaultState));
      this.save();
      FitPulseApp.onDataChanged();
    }
  };

  /* ==========================================================================
     2. CALORIE ENGINE
     ========================================================================== */
  const CalorieEngine = {
    // MET-based calories burned per minute for 70kg average individual
    MET_RATES: {
      'Walking': 4.5,
      'Running': 10.5,
      'Cycling': 8.0,
      'Exercise': 6.5,
      'Swimming': 9.0,
      'Yoga': 3.5,
      'Other': 5.0
    },

    estimate(type, minutes) {
      const rate = this.MET_RATES[type] || 5.0;
      return Math.round(rate * Math.max(1, minutes));
    }
  };

  /* ==========================================================================
     3. WELLNESS INSIGHT ENGINE (RULE-BASED SCORING 0-100)
     ========================================================================== */
  const WellnessEngine = {
    /**
     * Deterministic rule-based formula:
     * Steps = 30%
     * Activity = 25%
     * Water = 20%
     * Sleep = 25%
     * Cap each component at 100%
     */
    calculateScore(dayRecord, goals) {
      const steps = dayRecord.steps || 0;
      const activity = dayRecord.activity || 0;
      const water = dayRecord.water || 0;
      const sleep = dayRecord.sleep || 0;

      // Component percentages (0-100 capped)
      const stepsPct = Math.min(100, (steps / Math.max(1, goals.steps)) * 100);
      const activityPct = Math.min(100, (activity / Math.max(1, goals.activity)) * 100);
      const waterPct = Math.min(100, (water / Math.max(1, goals.water)) * 100);

      // Sleep quality curve: 7.0-9.0 hrs is optimal (100%), otherwise scaled
      let sleepPct = 0;
      if (sleep >= 7.0 && sleep <= 9.0) {
        sleepPct = 100;
      } else if (sleep >= 6.0 && sleep < 7.0) {
        sleepPct = 85;
      } else if (sleep > 9.0 && sleep <= 10.5) {
        sleepPct = 85;
      } else if (sleep > 0) {
        sleepPct = Math.min(100, Math.max(20, (sleep / Math.max(1, goals.sleep)) * 100));
      }

      // Weighted factors
      const factorSteps = (stepsPct * 0.30);
      const factorActivity = (activityPct * 0.25);
      const factorWater = (waterPct * 0.20);
      const factorSleep = (sleepPct * 0.25);

      const totalScore = Math.min(100, Math.round(factorSteps + factorActivity + factorWater + factorSleep));

      // Qualitative rating
      let rating = 'Needs Focus';
      let badgeClass = 'badge-wellness';
      if (totalScore >= 90) {
        rating = 'Peak Wellness';
      } else if (totalScore >= 75) {
        rating = 'Optimal Balance';
      } else if (totalScore >= 60) {
        rating = 'Good Progress';
      } else if (totalScore >= 40) {
        rating = 'Building Momentum';
      }

      return {
        score: totalScore,
        rating,
        badgeClass,
        breakdown: {
          steps: Math.round(factorSteps),
          activity: Math.round(factorActivity),
          water: Math.round(factorWater),
          sleep: Math.round(factorSleep)
        },
        percentages: {
          steps: Math.round(stepsPct),
          activity: Math.round(activityPct),
          water: Math.round(waterPct),
          sleep: Math.round(sleepPct)
        }
      };
    }
  };

  /* ==========================================================================
     4. SMART INSIGHT ENGINE (DETERMINISTIC HEURISTICS)
     ========================================================================== */
  const SmartInsightEngine = {
    generateTodayInsights(today, goals) {
      const insights = [];
      const stepsPct = (today.steps / goals.steps) * 100;
      const waterPct = (today.water / goals.water) * 100;
      const actPct = (today.activity / goals.activity) * 100;
      const sleep = today.sleep || 0;

      // Rule 1: Step Targets
      if (stepsPct >= 100) {
        insights.push({
          type: 'success',
          title: 'Daily Steps Conquered',
          text: `Outstanding! You reached ${today.steps.toLocaleString()} steps, surpassing your ${goals.steps.toLocaleString()} target.`
        });
      } else if (stepsPct >= 80) {
        insights.push({
          type: 'info',
          title: 'Step Goal in Sight',
          text: `You're close to completing your step goal! Just ${(goals.steps - today.steps).toLocaleString()} steps remaining.`
        });
      } else if (stepsPct < 50) {
        insights.push({
          type: 'warning',
          title: 'Step Progress Underway',
          text: "Your activity is still below today's step target. A short 15-minute walk will build quick momentum."
        });
      }

      // Rule 2: Water Hydration
      if (waterPct >= 100) {
        insights.push({
          type: 'success',
          title: 'Hydration Target Reached',
          text: `Target reached with ${today.water} ml logged. Excellent cellular hydration!`
        });
      } else if (waterPct < 50) {
        insights.push({
          type: 'warning',
          title: 'Hydration In Progress',
          text: 'Your hydration goal is still in progress. Drink a full glass of water to keep physical performance high.'
        });
      }

      // Rule 3: Activity Target
      if (actPct >= 100) {
        insights.push({
          type: 'success',
          title: 'Workout Target Achieved',
          text: `Today's activity target is complete with ${today.activity} minutes logged.`
        });
      }

      // Rule 4: Sleep Duration
      if (sleep >= 7.0 && sleep <= 9.0) {
        insights.push({
          type: 'success',
          title: 'Optimal Rest Logged',
          text: `You recorded ${sleep} hours of restorative sleep, perfect for muscle recovery and cognitive focus.`
        });
      } else if (sleep > 0 && sleep < 6.0) {
        insights.push({
          type: 'warning',
          title: 'Rest Deficit Noted',
          text: `Recorded sleep was ${sleep} hours. Try winding down 30 minutes earlier tonight for recovery.`
        });
      }

      // Rule 5: All Goals Completed
      if (stepsPct >= 100 && waterPct >= 100 && actPct >= 100 && sleep >= goals.sleep) {
        insights.unshift({
          type: 'success',
          title: 'Goal Mastery Achieved!',
          text: 'All major daily goals are complete. Great consistency and dedication today!'
        });
      }

      if (insights.length === 0) {
        insights.push({
          type: 'info',
          title: 'Ready for Today',
          text: 'Start your day by logging your morning water intake or a quick walk to ignite your streak!'
        });
      }

      return insights;
    },

    generateWeeklyTrends(daysMap, goals) {
      const dates = Object.keys(daysMap).sort();
      if (dates.length < 3) {
        return [{
          title: 'Building Weekly Profile',
          text: 'Log at least 3 days of activity to unlock multi-day velocity analysis and weekly patterns.'
        }];
      }

      const recent3 = dates.slice(-3);
      const previous3 = dates.slice(-6, -3);

      const recentAvg = recent3.reduce((sum, d) => sum + (daysMap[d].activity || 0), 0) / recent3.length;
      let prevAvg = recentAvg;
      if (previous3.length > 0) {
        prevAvg = previous3.reduce((sum, d) => sum + (daysMap[d].activity || 0), 0) / previous3.length;
      }

      const trendInsights = [];
      if (previous3.length > 0 && recentAvg > prevAvg + 5) {
        trendInsights.push({
          title: 'Upward Momentum Detected',
          text: 'Your recent activity has been trending upward compared with your earlier days. Keep pushing!'
        });
      } else if (previous3.length > 0 && recentAvg < prevAvg - 5) {
        trendInsights.push({
          title: 'Activity Dip Detected',
          text: 'Your recent activity has been lower than your earlier days. Schedule a dedicated 20-minute workout to rebound.'
        });
      } else {
        trendInsights.push({
          title: 'Consistent Routine',
          text: 'Your daily active minutes are holding steady across recent days.'
        });
      }

      // Count completed activity targets in last 7 days
      const last7 = dates.slice(-7);
      const completedDays = last7.filter(d => (daysMap[d].activity || 0) >= goals.activity).length;
      trendInsights.push({
        title: 'Weekly Goal Frequency',
        text: `Your activity goal was completed on ${completedDays} of your last ${last7.length} recorded days.`
      });

      return trendInsights;
    },

    generateHabitBalance(daysMap, goals) {
      const dates = Object.keys(daysMap).slice(-7);
      if (dates.length === 0) {
        return [{ title: 'No Data', text: 'Start logging habits to view your balance breakdown.' }];
      }

      let stepSuccess = 0;
      let waterSuccess = 0;
      let actSuccess = 0;
      let sleepSuccess = 0;

      dates.forEach(d => {
        const day = daysMap[d];
        if ((day.steps || 0) >= goals.steps) stepSuccess++;
        if ((day.water || 0) >= goals.water) waterSuccess++;
        if ((day.activity || 0) >= goals.activity) actSuccess++;
        if ((day.sleep || 0) >= goals.sleep) sleepSuccess++;
      });

      const results = [];
      const total = dates.length;

      // Identify lowest habit
      const habits = [
        { name: 'Steps', count: stepSuccess },
        { name: 'Hydration', count: waterSuccess },
        { name: 'Active Time', count: actSuccess },
        { name: 'Sleep', count: sleepSuccess }
      ].sort((a, b) => a.count - b.count);

      const lowest = habits[0];
      const highest = habits[habits.length - 1];

      if (lowest.count < total) {
        results.push({
          title: 'Area For Focus',
          text: `${lowest.name} was your least-completed target (${lowest.count}/${total} days). Prioritize this tomorrow.`
        });
      }

      results.push({
        title: 'Strongest Habit',
        text: `${highest.name} is your most consistent habit (${highest.count}/${total} days completed). Excellent routine!`
      });

      return results;
    }
  };

  /* ==========================================================================
     5. STREAK ENGINE
     ========================================================================== */
  const StreakEngine = {
    evaluateStreaks(daysMap, activityGoal) {
      // Sort dates ascending
      const dates = Object.keys(daysMap).sort();
      if (dates.length === 0) return { current: 0, longest: 0, last7Status: [] };

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      // Evaluate longest streak across entire history
      dates.forEach(date => {
        const day = daysMap[date];
        if ((day.activity || 0) >= activityGoal) {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }
      });

      // Calculate current streak backwards from today or yesterday
      const todayKey = Store.getTodayKey();
      const todayRecord = Store.getToday();
      const todayHit = (todayRecord.activity || 0) >= activityGoal;

      // Walk backward day by day
      let checkDate = new Date();
      if (!todayHit) {
        // If not met today yet, see if streak ended yesterday or is still active
        checkDate.setDate(checkDate.getDate() - 1);
      }

      let activeStreak = 0;
      while (true) {
        const y = checkDate.getFullYear();
        const m = String(checkDate.getMonth() + 1).padStart(2, '0');
        const d = String(checkDate.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;

        const day = daysMap[key];
        if (day && (day.activity || 0) >= activityGoal) {
          activeStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      currentStreak = activeStreak;
      if (todayHit && currentStreak === 0) currentStreak = 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;

      // Build 7-day mini heatmap array
      const last7Status = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        const k = `${y}-${m}-${dayNum}`;

        const rec = daysMap[k];
        let status = 'status-none';
        let icon = '–';

        if (rec) {
          if ((rec.activity || 0) >= activityGoal) {
            status = 'status-completed';
            icon = '✓';
          } else if ((rec.activity || 0) > 0 || (rec.steps || 0) > 0 || (rec.water || 0) > 0) {
            status = 'status-partial';
            icon = '•';
          }
        }

        last7Status.push({
          dateKey: k,
          dayName: dayNames[d.getDay()],
          dayNumber: d.getDate(),
          status,
          icon
        });
      }

      return {
        current: currentStreak,
        longest: longestStreak,
        last7Status
      };
    }
  };

  /* ==========================================================================
     6. ACHIEVEMENTS ENGINE
     ========================================================================== */
  const AchievementEngine = {
    DEFINITIONS: [
      {
        id: 'FIRST_STEP',
        title: 'FIRST STEP',
        icon: '👟',
        desc: 'Complete your first activity goal.',
        check: (days, goals, streaks) => {
          return Object.values(days).some(d => (d.activity || 0) >= goals.activity);
        }
      },
      {
        id: 'CONSISTENCY',
        title: 'CONSISTENCY',
        icon: '🔥',
        desc: 'Complete goals for 3 consecutive days.',
        check: (days, goals, streaks) => {
          return streaks.longest >= 3 || streaks.current >= 3;
        }
      },
      {
        id: 'WEEK_WARRIOR',
        title: 'WEEK WARRIOR',
        icon: '🛡️',
        desc: 'Complete goals for 7 consecutive days.',
        check: (days, goals, streaks) => {
          return streaks.longest >= 7 || streaks.current >= 7;
        }
      },
      {
        id: 'ACTIVITY_MASTER',
        title: 'ACTIVITY MASTER',
        icon: '⚡',
        desc: 'Accumulate over 300 total active minutes.',
        check: (days) => {
          const totalMins = Object.values(days).reduce((s, d) => s + (d.activity || 0), 0);
          return totalMins >= 300;
        }
      },
      {
        id: 'HYDRATION_HERO',
        title: 'HYDRATION HERO',
        icon: '💧',
        desc: 'Complete the daily water goal at least 5 times.',
        check: (days, goals) => {
          const count = Object.values(days).filter(d => (d.water || 0) >= goals.water).length;
          return count >= 5;
        }
      },
      {
        id: 'GOAL_CRUSHER',
        title: 'GOAL CRUSHER',
        icon: '👑',
        desc: 'Complete all major daily goals in a single day.',
        check: (days, goals) => {
          return Object.values(days).some(d =>
            (d.steps || 0) >= goals.steps &&
            (d.activity || 0) >= goals.activity &&
            (d.water || 0) >= goals.water &&
            (d.sleep || 0) >= goals.sleep
          );
        }
      }
    ],

    evaluateAndUnlock() {
      const { days, goals, streaks, achievements } = Store.data;
      let newlyUnlocked = null;

      this.DEFINITIONS.forEach(ach => {
        if (!achievements[ach.id]) {
          const unlocked = ach.check(days, goals, streaks);
          if (unlocked) {
            achievements[ach.id] = new Date().toISOString();
            newlyUnlocked = ach;
          }
        }
      });

      if (newlyUnlocked) {
        Store.save();
        FitPulseApp.showToast(`🏆 Achievement Unlocked: ${newlyUnlocked.title}!`, 'success');
      }
    }
  };

  /* ==========================================================================
     7. PURE VANILLA CANVAS CHART ENGINE (ZERO EXTERNAL LIBRARIES)
     ========================================================================== */
  const ChartEngine = {
    canvas: null,
    ctx: null,
    currentMetric: 'steps',
    tooltipEl: null,
    renderedBars: [],

    init() {
      this.canvas = document.getElementById('progress-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.tooltipEl = document.getElementById('canvas-tooltip');

      this.attachEvents();
      this.render();
    },

    attachEvents() {
      window.addEventListener('resize', () => {
        this.render();
      });

      if (!this.canvas) return;

      this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          this.handleHover(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        }
      }, { passive: true });
    },

    setMetric(metric) {
      this.currentMetric = metric;
      const titles = {
        steps: { title: '7-Day Steps Trend', sub: 'Comparing daily logged steps with your daily goal.' },
        water: { title: '7-Day Water Hydration Trend', sub: 'Comparing daily water intake (ml) with target.' },
        activity: { title: '7-Day Active Minutes Trend', sub: 'Daily exercise minutes vs target active time.' },
        wellness: { title: '7-Day Wellness Score Spline', sub: 'Longitudinal composite score (0-100) trend.' }
      };

      const info = titles[metric] || titles.steps;
      const titleEl = document.getElementById('active-chart-title');
      const subEl = document.getElementById('active-chart-sub');
      if (titleEl) titleEl.textContent = info.title;
      if (subEl) subEl.textContent = info.sub;

      this.render();
    },

    get7DayData() {
      const result = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${dayNum}`;

        const rec = Store.getDay(key);
        const wellness = WellnessEngine.calculateScore(rec, Store.data.goals);

        result.push({
          dateKey: key,
          dayLabel: dayNames[d.getDay()] + ' ' + d.getDate(),
          steps: rec.steps || 0,
          water: rec.water || 0,
          activity: rec.activity || 0,
          sleep: rec.sleep || 0,
          wellness: wellness.score
        });
      }
      return result;
    },

    render() {
      if (!this.canvas || !this.ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height || 320;

      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.ctx.scale(dpr, dpr);

      const ctx = this.ctx;
      ctx.clearRect(0, 0, width, height);

      const data = this.get7DayData();
      const metric = this.currentMetric;
      const goals = Store.data.goals;

      let targetVal = goals.steps;
      let unit = 'steps';
      let themeColor = '#10b981';
      let themeGradient = ['#10b981', '#34d399'];

      if (metric === 'water') {
        targetVal = goals.water;
        unit = 'ml';
        themeColor = '#0ea5e9';
        themeGradient = ['#0ea5e9', '#38bdf8'];
      } else if (metric === 'activity') {
        targetVal = goals.activity;
        unit = 'min';
        themeColor = '#f59e0b';
        themeGradient = ['#f59e0b', '#fbbf24'];
      } else if (metric === 'wellness') {
        targetVal = 80;
        unit = 'pts';
        themeColor = '#ec4899';
        themeGradient = ['#ec4899', '#f472b6'];
      }

      const padding = { top: 35, bottom: 40, left: 45, right: 25 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      // Determine Max Y value
      const maxVal = Math.max(targetVal * 1.2, ...data.map(d => d[metric] || 0), 10);

      // Draw Grid & Y-Axis Labels
      const gridSteps = 4;
      ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'light'
        ? 'rgba(0, 0, 0, 0.06)'
        : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';

      for (let i = 0; i <= gridSteps; i++) {
        const yVal = Math.round((maxVal / gridSteps) * i);
        const yPos = padding.top + chartHeight - (i / gridSteps) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(padding.left, yPos);
        ctx.lineTo(padding.left + chartWidth, yPos);
        ctx.stroke();

        ctx.fillText(yVal >= 1000 ? (yVal / 1000).toFixed(1) + 'k' : yVal, padding.left - 8, yPos + 4);
      }

      // Draw Target Reference Line
      const targetY = padding.top + chartHeight - (targetVal / maxVal) * chartHeight;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, targetY);
      ctx.lineTo(padding.left + chartWidth, targetY);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Target (${targetVal.toLocaleString()} ${unit})`, padding.left + chartWidth, targetY - 6);
      ctx.restore();

      this.renderedBars = [];

      if (metric === 'wellness') {
        // Line / Spline Chart with Gradient Area Fill
        const points = [];
        const stepX = chartWidth / (data.length - 1 || 1);

        data.forEach((item, index) => {
          const x = padding.left + index * stepX;
          const y = padding.top + chartHeight - (item.wellness / maxVal) * chartHeight;
          points.push({ x, y, data: item });
        });

        // Area Gradient
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        grad.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
        grad.addColorStop(1, 'rgba(236, 72, 153, 0.0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartHeight);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke Line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Points
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = themeColor;
          ctx.stroke();

          // Store for hover
          this.renderedBars.push({
            x: p.x - 15,
            y: p.y - 15,
            w: 30,
            h: 30,
            item: p.data,
            val: p.data.wellness,
            unit
          });
        });

      } else {
        // Bar Chart
        const barWidth = Math.min(38, chartWidth / (data.length * 1.6));
        const spacing = chartWidth / data.length;

        data.forEach((item, index) => {
          const x = padding.left + index * spacing + (spacing - barWidth) / 2;
          const val = item[metric] || 0;
          const barHeight = Math.max(3, (val / maxVal) * chartHeight);
          const y = padding.top + chartHeight - barHeight;

          // Bar Gradient
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, themeGradient[1]);
          grad.addColorStop(1, themeGradient[0]);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          // Value above bar if space permits
          if (val > 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            const valLabel = val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val;
            ctx.fillText(valLabel, x + barWidth / 2, y - 5);
          }

          // Store bounding box for tooltip
          this.renderedBars.push({
            x,
            y,
            w: barWidth,
            h: barHeight,
            item,
            val,
            unit
          });
        });
      }

      // Draw X-Axis Day Labels
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';

      const xSpacing = chartWidth / (data.length || 1);
      data.forEach((item, i) => {
        const xPos = padding.left + i * xSpacing + xSpacing / 2;
        ctx.fillText(item.dayLabel, xPos, height - 12);
      });
    },

    handleMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleHover(mouseX, mouseY);
    },

    handleHover(mouseX, mouseY) {
      if (!this.renderedBars || this.renderedBars.length === 0) return;

      const hit = this.renderedBars.find(b => {
        return mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= Math.min(b.y, 250) && mouseY <= b.y + b.h + 20;
      });

      if (hit && this.tooltipEl) {
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.innerHTML = `
          <strong>${hit.item.dayLabel}</strong><br/>
          <span>${hit.val.toLocaleString()} ${hit.unit}</span>
        `;
        this.tooltipEl.style.left = `${hit.x + hit.w / 2}px`;
        this.tooltipEl.style.top = `${Math.max(10, hit.y - 40)}px`;
      } else {
        this.hideTooltip();
      }
    },

    hideTooltip() {
      if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    }
  };

  /* ==========================================================================
     8. SAMPLE / DEMO DATA GENERATOR
     ========================================================================== */
  const DemoData = {
    load() {
      const goals = Store.data.goals;
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const demoDays = {};

      const workoutTypes = [
        { type: 'Running', mins: 35, notes: 'Morning park jog' },
        { type: 'Cycling', mins: 45, notes: 'Outdoor riverside route' },
        { type: 'Exercise', mins: 50, notes: 'Strength & core workout' },
        { type: 'Swimming', mins: 40, notes: 'Laps at fitness center' },
        { type: 'Walking', mins: 30, notes: 'Evening neighborhood brisk walk' },
        { type: 'Yoga', mins: 25, notes: 'Recovery stretch & breathwork' },
        { type: 'Running', mins: 40, notes: 'Interval sprints' }
      ];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        const k = `${y}-${m}-${dayNum}`;

        const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
        const wInfo = workoutTypes[i % workoutTypes.length];

        // Diverse realistic values
        const steps = isWeekend ? 9450 : (7200 + (i * 450) % 3800);
        const water = 2000 + (i * 250) % 1200;
        const sleep = Number((7.0 + (i * 0.4) % 1.8).toFixed(1));
        const actMins = wInfo.mins;

        const acts = [{
          id: 'act_demo_' + i,
          type: wInfo.type,
          duration: actMins,
          time: '08:15',
          notes: wInfo.notes,
          calories: CalorieEngine.estimate(wInfo.type, actMins)
        }];

        demoDays[k] = {
          steps,
          water,
          activity: actMins,
          sleep,
          activities: acts
        };
      }

      Store.data.days = demoDays;
      Store.data.isDemo = true;
      Store.data.profile.name = 'Alex Morgan (Demo)';
      Store.data.profile.onboarded = true;
      Store.save();

      FitPulseApp.onDataChanged();
      FitPulseApp.showToast('✅ 7-Day Demo Data Loaded Successfully!', 'success');
    },

    clear() {
      const todayKey = Store.getTodayKey();
      Store.data.days = {};
      Store.data.days[todayKey] = {
        steps: 0,
        water: 0,
        activity: 0,
        sleep: 0.0,
        activities: []
      };
      Store.data.isDemo = false;
      Store.data.streaks = { current: 0, longest: 0, lastEvaluatedDate: null };
      Store.data.achievements = {};
      Store.save();

      FitPulseApp.onDataChanged();
      FitPulseApp.showToast('🧹 Demo Data Cleared. Clean workspace ready!', 'success');
    }
  };

  /* ==========================================================================
     9. BACKUP EXPORT & IMPORT MODULE
     ========================================================================== */
  const BackupEngine = {
    exportJSON() {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(Store.data, null, 2));
      const downloadAnchor = document.createElement('a');
      const date = Store.getTodayKey();
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `fitpulse_x_backup_${date}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      FitPulseApp.showToast('📁 Application Data Exported to JSON!', 'success');
    },

    importJSON(file) {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          // Schema Validation
          if (!parsed.profile || !parsed.goals || !parsed.days) {
            FitPulseApp.showToast('❌ Invalid FitPulse backup file structure.', 'error');
            return;
          }

          Store.data = parsed;
          Store.save();
          FitPulseApp.onDataChanged();
          FitPulseApp.showToast('✅ Backup imported and restored successfully!', 'success');
        } catch (err) {
          FitPulseApp.showToast('❌ Error parsing JSON file.', 'error');
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  };

  /* ==========================================================================
     10. UI CONTROLLER & APP SHELL
     ========================================================================== */
  const FitPulseApp = {
    currentView: 'dashboard',

    init() {
      Store.init();
      this.initTheme();
      this.bindEvents();
      this.checkOnboarding();
      this.updateDateDisplay();
      this.renderAll();
      ChartEngine.init();
    },

    initTheme() {
      const savedTheme = Store.data.theme || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeButtonStates(savedTheme);
    },

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      Store.data.theme = next;
      Store.save();
      this.updateThemeButtonStates(next);
      ChartEngine.render();
      this.showToast(`Theme switched to ${next.toUpperCase()} mode`, 'info');
    },

    setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      Store.data.theme = theme;
      Store.save();
      this.updateThemeButtonStates(theme);
      ChartEngine.render();
    },

    updateThemeButtonStates(theme) {
      const darkBtn = document.getElementById('theme-btn-dark');
      const lightBtn = document.getElementById('theme-btn-light');
      if (darkBtn && lightBtn) {
        darkBtn.classList.toggle('active', theme === 'dark');
        lightBtn.classList.toggle('active', theme === 'light');
      }
    },

    bindEvents() {
      // Navigation Routing (Sidebar & Mobile)
      document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const view = btn.getAttribute('data-view');
          if (view) this.navigateTo(view);
        });
      });

      // Theme Toggles
      const dtToggle = document.getElementById('desktop-theme-toggle');
      if (dtToggle) dtToggle.addEventListener('click', () => this.toggleTheme());

      const mobToggle = document.getElementById('mobile-theme-toggle');
      if (mobToggle) mobToggle.addEventListener('click', () => this.toggleTheme());

      const themeDark = document.getElementById('theme-btn-dark');
      if (themeDark) themeDark.addEventListener('click', () => this.setTheme('dark'));

      const themeLight = document.getElementById('theme-btn-light');
      if (themeLight) themeLight.addEventListener('click', () => this.setTheme('light'));

      // Quick Add Triggers
      const topQuick = document.getElementById('topbar-quick-add');
      if (topQuick) topQuick.addEventListener('click', () => this.openModal('modal-activity'));

      const mobQuick = document.getElementById('mobile-quick-add-btn');
      if (mobQuick) mobQuick.addEventListener('click', () => this.openModal('modal-activity'));

      document.getElementById('btn-quick-steps')?.addEventListener('click', () => this.openModal('modal-steps'));
      document.getElementById('btn-quick-water')?.addEventListener('click', () => this.openModal('modal-water'));
      document.getElementById('btn-quick-activity')?.addEventListener('click', () => this.openModal('modal-activity'));
      document.getElementById('btn-quick-sleep')?.addEventListener('click', () => this.openModal('modal-sleep'));
      document.getElementById('dash-btn-add-activity')?.addEventListener('click', () => this.openModal('modal-activity'));
      document.getElementById('dash-btn-view-insights')?.addEventListener('click', () => this.navigateTo('insights'));

      // Forms
      document.getElementById('form-onboarding')?.addEventListener('submit', (e) => this.handleOnboardingSubmit(e));
      document.getElementById('btn-onboard-demo')?.addEventListener('click', () => {
        this.closeModal('modal-onboarding');
        DemoData.load();
      });

      document.getElementById('form-add-steps')?.addEventListener('submit', (e) => this.handleAddSteps(e));
      document.getElementById('form-add-water')?.addEventListener('submit', (e) => this.handleAddWater(e));
      document.getElementById('form-add-activity')?.addEventListener('submit', (e) => this.handleAddActivity(e));
      document.getElementById('form-add-sleep')?.addEventListener('submit', (e) => this.handleAddSleep(e));

      // Dynamic Activity Calorie Preview in modal
      const actTypeSelect = document.getElementById('input-act-type');
      const actDurationInput = document.getElementById('input-act-duration');
      const updateCalPreview = () => {
        const t = actTypeSelect ? actTypeSelect.value : 'Walking';
        const m = actDurationInput ? Number(actDurationInput.value) || 30 : 30;
        const est = CalorieEngine.estimate(t, m);
        const pEl = document.getElementById('act-calorie-preview');
        if (pEl) pEl.innerHTML = `Estimated Burn: <strong>~${est} kcal</strong> (${CalorieEngine.MET_RATES[t] || 5} kcal/min)`;
      };
      actTypeSelect?.addEventListener('change', updateCalPreview);
      actDurationInput?.addEventListener('input', updateCalPreview);

      // Goals Actions
      document.getElementById('btn-save-goals')?.addEventListener('click', () => this.handleSaveGoals());
      document.getElementById('btn-reset-goals-default')?.addEventListener('click', () => this.handleResetGoalsDefault());

      // Settings Actions
      document.getElementById('btn-save-profile')?.addEventListener('click', () => this.handleSaveProfile());
      document.getElementById('btn-load-demo-data')?.addEventListener('click', () => DemoData.load());
      document.getElementById('btn-clear-demo-data')?.addEventListener('click', () => DemoData.clear());
      document.getElementById('btn-clear-demo-banner')?.addEventListener('click', () => DemoData.clear());

      // Export / Import / Reset
      document.getElementById('btn-export-json')?.addEventListener('click', () => BackupEngine.exportJSON());
      const importInput = document.getElementById('file-import-json');
      if (importInput) {
        importInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            BackupEngine.importJSON(e.target.files[0]);
            e.target.value = '';
          }
        });
      }

      document.getElementById('btn-trigger-reset')?.addEventListener('click', () => this.openModal('modal-reset'));
      document.getElementById('btn-confirm-reset')?.addEventListener('click', () => this.handleConfirmReset());

      // Chart Metric Tab Switcher
      document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const m = tab.getAttribute('data-chart');
          ChartEngine.setMetric(m);
        });
      });

      // Activity Filters
      document.getElementById('act-search-input')?.addEventListener('input', () => this.renderActivityTimeline());
      document.getElementById('act-category-filter')?.addEventListener('change', () => this.renderActivityTimeline());

      // History Date Filter
      document.getElementById('history-date-filter')?.addEventListener('change', (e) => this.filterHistory(e.target.value));
      document.getElementById('btn-history-clear-filter')?.addEventListener('click', () => {
        const hInput = document.getElementById('history-date-filter');
        if (hInput) hInput.value = '';
        this.filterHistory('');
      });

      // Keyboard Esc modal closer
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
            modal.classList.remove('active');
          });
        }
      });
    },

    navigateTo(viewId) {
      this.currentView = viewId;

      // Update Nav active classes
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-view') === viewId);
      });

      document.querySelectorAll('.mobile-nav-btn').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-view') === viewId);
      });

      // Update Panel visibility
      document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
      });

      const targetPanel = document.getElementById(`view-${viewId}`);
      if (targetPanel) targetPanel.classList.add('active');

      // Refresh specific views
      if (viewId === 'progress') {
        setTimeout(() => ChartEngine.render(), 50);
      } else if (viewId === 'activity') {
        this.renderActivityTimeline();
      } else if (viewId === 'history') {
        this.renderHistoryTable();
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    checkOnboarding() {
      if (!Store.data.profile.onboarded && Object.keys(Store.data.days).length <= 1 && Store.getToday().steps === 0) {
        this.openModal('modal-onboarding');
      }
    },

    openModal(modalId) {
      const m = document.getElementById(modalId);
      if (m) {
        m.classList.add('active');
        const firstInput = m.querySelector('input, select');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
      }
    },

    closeModal(modalId) {
      const m = document.getElementById(modalId);
      if (m) m.classList.remove('active');
    },

    showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <span class="toast-text">${message}</span>
      `;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    },

    updateDateDisplay() {
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      const dateStr = now.toLocaleDateString('en-US', options);

      const dateEl = document.getElementById('date-label');
      if (dateEl) dateEl.textContent = dateStr;

      // Greeting based on hour
      const hour = now.getHours();
      let greeting = 'Good morning';
      if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
      else if (hour >= 17) greeting = 'Good evening';

      const greetingEl = document.getElementById('topbar-greeting');
      const userName = Store.data.profile.name || 'Alex';
      if (greetingEl) greetingEl.textContent = `${greeting}, ${userName.split(' ')[0]}`;
    },

    onDataChanged() {
      // Re-evaluate Streaks
      const streakInfo = StreakEngine.evaluateStreaks(Store.data.days, Store.data.goals.activity);
      Store.data.streaks.current = streakInfo.current;
      Store.data.streaks.longest = streakInfo.longest;
      Store.save();

      // Re-evaluate Achievements
      AchievementEngine.evaluateAndUnlock();

      // Re-render UI
      this.renderAll();
      ChartEngine.render();
    },

    renderAll() {
      this.renderTopbarAndProfile();
      this.renderDashboardCards();
      this.renderInsights();
      this.renderHabitStreak();
      this.renderTodayTimeline();
      this.renderActivityTimeline();
      this.renderGoalsPage();
      this.renderAchievements();
      this.renderHistoryTable();
      this.renderProgressSummary();
      this.renderDemoBanner();
    },

    renderTopbarAndProfile() {
      const profile = Store.data.profile;
      const streaks = Store.data.streaks;

      const avatarEl = document.getElementById('sidebar-avatar');
      const nameEl = document.getElementById('sidebar-user-name');
      const streakEl = document.getElementById('sidebar-streak-count');
      const topGreeting = document.getElementById('topbar-greeting');

      const initials = profile.name
        ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : 'FP';

      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = profile.name;
      if (streakEl) streakEl.textContent = `${streaks.current} ${streaks.current === 1 ? 'Day' : 'Days'}`;

      this.updateDateDisplay();
    },

    renderDemoBanner() {
      const banner = document.getElementById('demo-banner');
      if (banner) {
        banner.style.display = Store.data.isDemo ? 'flex' : 'none';
      }
    },

    renderDashboardCards() {
      const today = Store.getToday();
      const goals = Store.data.goals;

      // 1. Steps
      const stepsCur = today.steps || 0;
      const stepsGoal = goals.steps;
      const stepsPct = Math.min(100, Math.round((stepsCur / Math.max(1, stepsGoal)) * 100));
      const stepsRem = Math.max(0, stepsGoal - stepsCur);

      document.getElementById('dash-steps-current').textContent = stepsCur.toLocaleString();
      document.getElementById('dash-steps-goal').textContent = stepsGoal.toLocaleString();
      document.getElementById('dash-steps-pct').textContent = `${stepsPct}%`;
      document.getElementById('dash-steps-bar').style.width = `${stepsPct}%`;
      document.getElementById('dash-steps-remaining').textContent = stepsRem > 0 ? `${stepsRem.toLocaleString()} to go` : 'Target Achieved!';
      const stepsBadge = document.getElementById('steps-status-badge');
      if (stepsBadge) {
        stepsBadge.textContent = stepsPct >= 100 ? 'Achieved ✓' : 'In Progress';
        stepsBadge.className = stepsPct >= 100 ? 'metric-badge badge-success' : 'metric-badge';
      }

      // 2. Activity Minutes
      const actCur = today.activity || 0;
      const actGoal = goals.activity;
      const actPct = Math.min(100, Math.round((actCur / Math.max(1, actGoal)) * 100));
      const actRem = Math.max(0, actGoal - actCur);

      document.getElementById('dash-activity-current').textContent = actCur;
      document.getElementById('dash-activity-goal').textContent = actGoal;
      document.getElementById('dash-activity-pct').textContent = `${actPct}%`;
      document.getElementById('dash-activity-bar').style.width = `${actPct}%`;
      document.getElementById('dash-activity-remaining').textContent = actRem > 0 ? `${actRem} min to target` : 'Target Achieved!';
      const actBadge = document.getElementById('activity-status-badge');
      if (actBadge) {
        actBadge.textContent = actPct >= 100 ? 'Achieved ✓' : 'In Progress';
        actBadge.className = actPct >= 100 ? 'metric-badge badge-success' : 'metric-badge';
      }

      // 3. Water
      const waterCur = today.water || 0;
      const waterGoal = goals.water;
      const waterPct = Math.min(100, Math.round((waterCur / Math.max(1, waterGoal)) * 100));
      const waterRem = Math.max(0, waterGoal - waterCur);

      document.getElementById('dash-water-current').textContent = waterCur.toLocaleString();
      document.getElementById('dash-water-goal').textContent = waterGoal.toLocaleString();
      document.getElementById('dash-water-pct').textContent = `${waterPct}%`;
      document.getElementById('dash-water-bar').style.width = `${waterPct}%`;
      document.getElementById('dash-water-remaining').textContent = waterRem > 0 ? `${waterRem.toLocaleString()} ml remaining` : 'Hydrated!';
      const waterBadge = document.getElementById('water-status-badge');
      if (waterBadge) {
        waterBadge.textContent = waterPct >= 100 ? 'Achieved ✓' : 'In Progress';
        waterBadge.className = waterPct >= 100 ? 'metric-badge badge-success' : 'metric-badge';
      }

      // 4. Sleep
      const sleepCur = today.sleep || 0.0;
      const sleepGoal = goals.sleep;
      const sleepPct = Math.min(100, Math.round((sleepCur / Math.max(1, sleepGoal)) * 100));

      document.getElementById('dash-sleep-current').textContent = sleepCur.toFixed(1);
      document.getElementById('dash-sleep-goal').textContent = sleepGoal.toFixed(1);
      document.getElementById('dash-sleep-pct').textContent = `${sleepPct}%`;
      document.getElementById('dash-sleep-bar').style.width = `${sleepPct}%`;
      document.getElementById('dash-sleep-remaining').textContent = sleepCur >= 7.0 ? 'Optimal Rest' : (sleepCur > 0 ? 'Light Rest' : 'Not logged yet');

      // 5. Wellness Score Engine
      const wellness = WellnessEngine.calculateScore(today, goals);
      document.getElementById('dash-wellness-score').textContent = wellness.score;
      const wellnessRatingEl = document.getElementById('dash-wellness-rating');
      if (wellnessRatingEl) {
        wellnessRatingEl.textContent = wellness.rating;
      }

      // Circular gauge animation: circumference = 2 * PI * 40 = ~251.2
      const circle = document.getElementById('dash-wellness-circle');
      if (circle) {
        const offset = 251.2 - (wellness.score / 100) * 251.2;
        circle.style.strokeDashoffset = offset;
      }

      // Breakdown mini factors
      document.getElementById('wf-steps').textContent = `${wellness.breakdown.steps}/30`;
      document.getElementById('wf-activity').textContent = `${wellness.breakdown.activity}/25`;
      document.getElementById('wf-water').textContent = `${wellness.breakdown.water}/20`;
      document.getElementById('wf-sleep').textContent = `${wellness.breakdown.sleep}/25`;

      // 6. Daily Goal Completion
      let goalsMet = 0;
      if (stepsCur >= stepsGoal) goalsMet++;
      if (actCur >= actGoal) goalsMet++;
      if (waterCur >= waterGoal) goalsMet++;
      if (sleepCur >= sleepGoal) goalsMet++;

      const completionPct = Math.round((goalsMet / 4) * 100);
      document.getElementById('dash-goals-achieved').textContent = `${goalsMet} of 4`;
      document.getElementById('dash-completion-pct').textContent = `${completionPct}%`;
      document.getElementById('dash-goals-bar').style.width = `${completionPct}%`;
      document.getElementById('completion-status-badge').textContent = `${goalsMet} / 4`;

      document.getElementById('gcheck-steps')?.classList.toggle('met', stepsCur >= stepsGoal);
      document.getElementById('gcheck-activity')?.classList.toggle('met', actCur >= actGoal);
      document.getElementById('gcheck-water')?.classList.toggle('met', waterCur >= waterGoal);
      document.getElementById('gcheck-sleep')?.classList.toggle('met', sleepCur >= sleepGoal);

      const streakReminder = document.getElementById('dash-streak-reminder');
      if (streakReminder) {
        streakReminder.textContent = actCur >= actGoal ? '🔥 Streak Qualifies Today!' : '⚡ Hit activity goal to build streak';
      }
    },

    renderInsights() {
      const today = Store.getToday();
      const goals = Store.data.goals;
      const days = Store.data.days;

      const todayInsights = SmartInsightEngine.generateTodayInsights(today, goals);
      const weeklyTrends = SmartInsightEngine.generateWeeklyTrends(days, goals);
      const habitBalance = SmartInsightEngine.generateHabitBalance(days, goals);

      // Main Banner Snapshot
      const bannerTextEl = document.getElementById('dash-insight-text');
      if (bannerTextEl && todayInsights.length > 0) {
        bannerTextEl.textContent = todayInsights[0].text;
      }

      // Insights Tab: Today's list
      const todayListEl = document.getElementById('insights-today-list');
      if (todayListEl) {
        todayListEl.innerHTML = todayInsights.map(item => `
          <div class="insight-point">
            <strong>${item.title}</strong>
            <span>${item.text}</span>
          </div>
        `).join('');
      }

      // Insights Tab: Weekly Trends
      const weeklyListEl = document.getElementById('insights-weekly-list');
      if (weeklyListEl) {
        weeklyListEl.innerHTML = weeklyTrends.map(item => `
          <div class="insight-point">
            <strong>${item.title}</strong>
            <span>${item.text}</span>
          </div>
        `).join('');
      }

      // Insights Tab: Goal Balance
      const balanceListEl = document.getElementById('insights-goal-balance');
      if (balanceListEl) {
        balanceListEl.innerHTML = habitBalance.map(item => `
          <div class="insight-point">
            <strong>${item.title}</strong>
            <span>${item.text}</span>
          </div>
        `).join('');
      }

      // Insights Tab: Consistency
      const consistencyEl = document.getElementById('insights-consistency-list');
      if (consistencyEl) {
        const currentStreak = Store.data.streaks.current;
        consistencyEl.innerHTML = `
          <div class="insight-point">
            <strong>Current Active Streak</strong>
            <span>You are currently on a ${currentStreak}-day workout consistency streak. Keep it alive by logging active minutes daily!</span>
          </div>
          <div class="insight-point">
            <strong>Streak Protection Tip</strong>
            <span>Even a 15-minute quick session counts toward maintaining momentum and building neural habit pathways.</span>
          </div>
        `;
      }
    },

    renderHabitStreak() {
      const streaks = Store.data.streaks;
      const goals = Store.data.goals;
      const streakInfo = StreakEngine.evaluateStreaks(Store.data.days, goals.activity);

      document.getElementById('dash-streak-banner').textContent = `🔥 ${streaks.current} ${streaks.current === 1 ? 'Day' : 'Days'}`;
      document.getElementById('dash-streak-current').textContent = `${streaks.current} ${streaks.current === 1 ? 'Day' : 'Days'}`;
      document.getElementById('dash-streak-longest').textContent = `${streaks.longest} ${streaks.longest === 1 ? 'Day' : 'Days'}`;

      // 7-day completion rate
      const completedCount = streakInfo.last7Status.filter(s => s.status === 'status-completed').length;
      const ratePct = Math.round((completedCount / 7) * 100);
      document.getElementById('dash-7day-rate').textContent = `${ratePct}%`;

      // Mini Calendar Nodes
      const calContainer = document.getElementById('dash-mini-calendar');
      if (calContainer) {
        calContainer.innerHTML = streakInfo.last7Status.map(d => `
          <div class="cal-day-node" title="${d.dateKey}">
            <span class="cal-day-name">${d.dayName}</span>
            <div class="cal-status-icon ${d.status}">${d.icon}</div>
          </div>
        `).join('');
      }
    },

    renderTodayTimeline() {
      const today = Store.getToday();
      const listEl = document.getElementById('dash-timeline-list');
      if (!listEl) return;

      const acts = today.activities || [];
      const countEl = document.getElementById('nav-activity-count');
      if (countEl) countEl.textContent = acts.length;

      if (acts.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state-box" id="dash-timeline-empty">
            <div class="empty-state-icon">👟</div>
            <div class="empty-state-title">No activities recorded today</div>
            <div class="empty-state-text">Start by logging your morning walk, gym session, or commute.</div>
            <button class="btn btn-sm btn-primary mt-2" onclick="FitPulseApp.openModal('modal-activity')">+ Log First Activity</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = acts.map(act => `
        <div class="timeline-item">
          <div class="timeline-left">
            <div class="timeline-time-badge">${act.time || '--:--'}</div>
            <div class="timeline-info">
              <div class="timeline-type-row">
                <span class="timeline-type">${act.type}</span>
                <span class="timeline-duration">${act.duration} min</span>
              </div>
              ${act.notes ? `<span class="timeline-notes">${act.notes}</span>` : ''}
            </div>
          </div>
          <div class="timeline-right">
            <span class="timeline-calories">~${act.calories || CalorieEngine.estimate(act.type, act.duration)} kcal</span>
            <button class="btn-delete-act" onclick="FitPulseApp.handleDeleteActivity('${act.id}')" title="Delete workout" aria-label="Delete workout">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `).join('');
    },

    renderActivityTimeline() {
      const today = Store.getToday();
      const listEl = document.getElementById('actview-timeline-list');
      if (!listEl) return;

      let acts = (today.activities || []).slice();

      // Filter by search
      const query = (document.getElementById('act-search-input')?.value || '').toLowerCase().trim();
      if (query) {
        acts = acts.filter(a => a.type.toLowerCase().includes(query) || (a.notes && a.notes.toLowerCase().includes(query)));
      }

      // Filter by category
      const category = document.getElementById('act-category-filter')?.value || 'ALL';
      if (category !== 'ALL') {
        acts = acts.filter(a => a.type === category);
      }

      // Update Summary metrics
      const totalActs = today.activities || [];
      const totalCount = totalActs.length;
      const totalMins = totalActs.reduce((s, a) => s + (a.duration || 0), 0);
      const totalCals = totalActs.reduce((s, a) => s + (a.calories || CalorieEngine.estimate(a.type, a.duration)), 0);

      // Primary Exercise
      const counts = {};
      totalActs.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
      let primaryType = 'None';
      let maxC = 0;
      for (const [t, c] of Object.entries(counts)) {
        if (c > maxC) { maxC = c; primaryType = t; }
      }

      document.getElementById('actview-total-count').textContent = totalCount;
      document.getElementById('actview-total-time').textContent = `${totalMins} min`;
      document.getElementById('actview-total-calories').textContent = `${totalCals.toLocaleString()} kcal`;
      document.getElementById('actview-primary-type').textContent = primaryType;

      if (acts.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state-box">
            <div class="empty-state-icon">🏃</div>
            <div class="empty-state-title">No matching activities found</div>
            <div class="empty-state-text">Adjust your search query or log a new workout session above.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = acts.map(act => `
        <div class="timeline-item">
          <div class="timeline-left">
            <div class="timeline-time-badge">${act.time || '--:--'}</div>
            <div class="timeline-info">
              <div class="timeline-type-row">
                <span class="timeline-type">${act.type}</span>
                <span class="timeline-duration">${act.duration} min</span>
              </div>
              ${act.notes ? `<span class="timeline-notes">${act.notes}</span>` : ''}
            </div>
          </div>
          <div class="timeline-right">
            <span class="timeline-calories">~${act.calories || CalorieEngine.estimate(act.type, act.duration)} kcal</span>
            <button class="btn-delete-act" onclick="FitPulseApp.handleDeleteActivity('${act.id}')" title="Delete workout" aria-label="Delete workout">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `).join('');
    },

    renderGoalsPage() {
      const goals = Store.data.goals;
      const today = Store.getToday();

      // Form input defaults
      const stepInput = document.getElementById('input-goal-steps');
      const actInput = document.getElementById('input-goal-activity');
      const waterInput = document.getElementById('input-goal-water');
      const sleepInput = document.getElementById('input-goal-sleep');

      if (stepInput) stepInput.value = goals.steps;
      if (actInput) actInput.value = goals.activity;
      if (waterInput) waterInput.value = goals.water;
      if (sleepInput) sleepInput.value = goals.sleep;

      // Current progress displays
      const sPct = Math.min(100, Math.round(((today.steps || 0) / goals.steps) * 100));
      document.getElementById('goalview-steps-progress').textContent = `${(today.steps || 0).toLocaleString()} / ${goals.steps.toLocaleString()} (${sPct}%)`;
      document.getElementById('goalview-steps-bar').style.width = `${sPct}%`;

      const aPct = Math.min(100, Math.round(((today.activity || 0) / goals.activity) * 100));
      document.getElementById('goalview-activity-progress').textContent = `${today.activity || 0} / ${goals.activity} min (${aPct}%)`;
      document.getElementById('goalview-activity-bar').style.width = `${aPct}%`;

      const wPct = Math.min(100, Math.round(((today.water || 0) / goals.water) * 100));
      document.getElementById('goalview-water-progress').textContent = `${(today.water || 0).toLocaleString()} / ${goals.water.toLocaleString()} ml (${wPct}%)`;
      document.getElementById('goalview-water-bar').style.width = `${wPct}%`;

      const slPct = Math.min(100, Math.round(((today.sleep || 0) / goals.sleep) * 100));
      document.getElementById('goalview-sleep-progress').textContent = `${(today.sleep || 0).toFixed(1)} / ${goals.sleep.toFixed(1)} hrs (${slPct}%)`;
      document.getElementById('goalview-sleep-bar').style.width = `${slPct}%`;
    },

    renderAchievements() {
      const grid = document.getElementById('achievements-card-grid');
      if (!grid) return;

      const achievements = Store.data.achievements;
      const defs = AchievementEngine.DEFINITIONS;
      let unlockedCount = 0;

      grid.innerHTML = defs.map(ach => {
        const isUnlocked = Boolean(achievements[ach.id]);
        if (isUnlocked) unlockedCount++;
        const unlockDate = isUnlocked ? new Date(achievements[ach.id]).toLocaleDateString() : '';

        return `
          <div class="card achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-content">
              <div class="achievement-title">${ach.title}</div>
              <div class="achievement-desc">${ach.desc}</div>
              <span class="achievement-status-tag">
                ${isUnlocked ? `Unlocked on ${unlockDate}` : '🔒 In Progress'}
              </span>
            </div>
          </div>
        `;
      }).join('');

      document.getElementById('achieve-unlocked-count').textContent = unlockedCount;
      document.getElementById('achieve-total-count').textContent = defs.length;
      const navAchCount = document.getElementById('nav-achievement-count');
      if (navAchCount) navAchCount.textContent = `${unlockedCount}/${defs.length}`;
    },

    renderHistoryTable() {
      this.filterHistory(document.getElementById('history-date-filter')?.value || '');
    },

    filterHistory(filterDate) {
      const tbody = document.getElementById('history-tbody');
      const emptyEl = document.getElementById('history-empty');
      if (!tbody) return;

      const days = Store.data.days;
      let dateKeys = Object.keys(days).sort().reverse();

      if (filterDate) {
        dateKeys = dateKeys.filter(k => k === filterDate);
      }

      if (dateKeys.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      const goals = Store.data.goals;

      tbody.innerHTML = dateKeys.map(date => {
        const day = days[date];
        const wellness = WellnessEngine.calculateScore(day, goals);

        let goalsMet = 0;
        if ((day.steps || 0) >= goals.steps) goalsMet++;
        if ((day.activity || 0) >= goals.activity) goalsMet++;
        if ((day.water || 0) >= goals.water) goalsMet++;
        if ((day.sleep || 0) >= goals.sleep) goalsMet++;

        return `
          <tr>
            <td><strong>${date}</strong></td>
            <td>${(day.steps || 0).toLocaleString()}</td>
            <td>${day.activity || 0} min</td>
            <td>${(day.water || 0).toLocaleString()} ml</td>
            <td>${(day.sleep || 0).toFixed(1)} hrs</td>
            <td>
              <span class="metric-badge ${wellness.badgeClass}">${wellness.score} (${wellness.rating})</span>
            </td>
            <td><strong>${goalsMet} / 4</strong></td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="FitPulseApp.viewDayDetail('${date}')">View Details</button>
            </td>
          </tr>
        `;
      }).join('');
    },

    viewDayDetail(dateKey) {
      const day = Store.getDay(dateKey);
      const goals = Store.data.goals;
      const wellness = WellnessEngine.calculateScore(day, goals);

      const titleDate = document.getElementById('day-detail-date');
      if (titleDate) titleDate.textContent = `Date: ${dateKey}`;

      const body = document.getElementById('day-detail-body');
      if (!body) return;

      const acts = day.activities || [];
      body.innerHTML = `
        <div class="metrics-grid mb-3">
          <div class="asc-card card">
            <span class="asc-label">Steps</span>
            <span class="asc-val">${(day.steps || 0).toLocaleString()}</span>
          </div>
          <div class="asc-card card">
            <span class="asc-label">Active Time</span>
            <span class="asc-val">${day.activity || 0} min</span>
          </div>
          <div class="asc-card card">
            <span class="asc-label">Water</span>
            <span class="asc-val">${(day.water || 0).toLocaleString()} ml</span>
          </div>
          <div class="asc-card card">
            <span class="asc-label">Sleep</span>
            <span class="asc-val">${(day.sleep || 0).toFixed(1)} hrs</span>
          </div>
        </div>

        <div class="card mb-3">
          <h4 class="card-title mb-1">Wellness Score Breakdown: ${wellness.score} / 100</h4>
          <p class="card-subtitle mb-2">Rating: <strong>${wellness.rating}</strong></p>
          <div class="wellness-breakdown-mini">
            <div class="mini-factor"><span>Steps:</span><strong>${wellness.breakdown.steps}/30</strong></div>
            <div class="mini-factor"><span>Activity:</span><strong>${wellness.breakdown.activity}/25</strong></div>
            <div class="mini-factor"><span>Water:</span><strong>${wellness.breakdown.water}/20</strong></div>
            <div class="mini-factor"><span>Sleep:</span><strong>${wellness.breakdown.sleep}/25</strong></div>
          </div>
        </div>

        <h4 class="card-title mb-2">Activities Logged (${acts.length})</h4>
        <div class="activity-full-timeline">
          ${acts.length > 0 ? acts.map(a => `
            <div class="timeline-item">
              <div class="timeline-left">
                <span class="timeline-time-badge">${a.time || '--:--'}</span>
                <div class="timeline-info">
                  <span class="timeline-type">${a.type}</span>
                  ${a.notes ? `<span class="timeline-notes">${a.notes}</span>` : ''}
                </div>
              </div>
              <div class="timeline-right">
                <span class="timeline-duration">${a.duration} min</span>
                <span class="timeline-calories">~${a.calories || CalorieEngine.estimate(a.type, a.duration)} kcal</span>
              </div>
            </div>
          `).join('') : '<p class="text-muted">No individual workout sessions logged on this day.</p>'}
        </div>
      `;

      this.openModal('modal-day-detail');
    },

    renderProgressSummary() {
      const data = ChartEngine.get7DayData();
      const count = data.length || 1;

      const totalSteps = data.reduce((s, d) => s + d.steps, 0);
      const totalWater = data.reduce((s, d) => s + d.water, 0);
      const totalAct = data.reduce((s, d) => s + d.activity, 0);
      const totalWell = data.reduce((s, d) => s + d.wellness, 0);

      const avgSteps = Math.round(totalSteps / count);
      const avgWater = Math.round(totalWater / count);
      const avgAct = Math.round(totalAct / count);
      const avgWell = Math.round(totalWell / count);

      document.getElementById('prog-avg-steps').textContent = avgSteps.toLocaleString();
      document.getElementById('prog-avg-water').textContent = `${avgWater.toLocaleString()} ml`;
      document.getElementById('prog-avg-activity').textContent = `${avgAct} min`;
      document.getElementById('prog-avg-wellness').textContent = `${avgWell} / 100`;

      // 7-day breakdown table
      const tbody = document.getElementById('progress-breakdown-tbody');
      if (tbody) {
        tbody.innerHTML = data.map(d => `
          <tr>
            <td><strong>${d.dayLabel}</strong></td>
            <td>${d.steps.toLocaleString()}</td>
            <td>${d.activity} min</td>
            <td>${d.water.toLocaleString()} ml</td>
            <td>${d.sleep.toFixed(1)} hrs</td>
            <td><strong>${d.wellness} / 100</strong></td>
            <td>
              <span class="goal-pill-check ${d.activity >= Store.data.goals.activity ? 'met' : ''}">
                ${d.activity >= Store.data.goals.activity ? '✓ Goal Met' : 'Partial'}
              </span>
            </td>
          </tr>
        `).join('');
      }
    },

    /* Form & Action Handlers */
    handleOnboardingSubmit(e) {
      e.preventDefault();
      const name = document.getElementById('onboard-name').value.trim();
      const steps = Number(document.getElementById('onboard-steps').value);
      const water = Number(document.getElementById('onboard-water').value);
      const activity = Number(document.getElementById('onboard-activity').value);
      const sleep = Number(document.getElementById('onboard-sleep').value);

      if (!name) {
        this.showToast('Please enter your name.', 'error');
        return;
      }

      Store.data.profile.name = name;
      Store.data.profile.onboarded = true;
      Store.data.goals.steps = Math.max(1000, steps || 8000);
      Store.data.goals.water = Math.max(500, water || 2500);
      Store.data.goals.activity = Math.max(15, activity || 45);
      Store.data.goals.sleep = Math.max(4.0, sleep || 8.0);
      Store.save();

      this.closeModal('modal-onboarding');
      this.onDataChanged();
      this.showToast(`Welcome to FitPulse X, ${name}! Your dashboard is ready.`, 'success');
    },

    handleAddSteps(e) {
      e.preventDefault();
      const input = document.getElementById('input-steps-amount');
      const amount = Number(input.value);
      if (!amount || amount <= 0) {
        this.showToast('Please enter a positive step number.', 'error');
        return;
      }
      Store.updateMetric('steps', amount);
      input.value = '';
      this.closeModal('modal-steps');
      this.showToast(`+${amount.toLocaleString()} steps logged!`, 'success');
    },

    handleAddWater(e) {
      e.preventDefault();
      const input = document.getElementById('input-water-amount');
      const amount = Number(input.value);
      if (!amount || amount <= 0) {
        this.showToast('Please enter a valid water volume in ml.', 'error');
        return;
      }
      Store.updateMetric('water', amount);
      input.value = '';
      this.closeModal('modal-water');
      this.showToast(`+${amount.toLocaleString()} ml water hydration logged!`, 'success');
    },

    handleAddActivity(e) {
      e.preventDefault();
      const type = document.getElementById('input-act-type').value;
      const duration = Number(document.getElementById('input-act-duration').value);
      let time = document.getElementById('input-act-time').value;
      const notes = document.getElementById('input-act-notes').value.trim();

      if (!duration || duration <= 0) {
        this.showToast('Please enter a valid workout duration in minutes.', 'error');
        return;
      }

      if (!time) {
        const now = new Date();
        time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }

      const calories = CalorieEngine.estimate(type, duration);
      const activity = {
        id: 'act_' + Date.now(),
        type,
        duration,
        time,
        notes,
        calories
      };

      Store.addActivity(activity);
      document.getElementById('input-act-duration').value = '';
      document.getElementById('input-act-notes').value = '';
      this.closeModal('modal-activity');
      this.showToast(`Saved ${duration} min of ${type} (~${calories} kcal)!`, 'success');
    },

    handleDeleteActivity(actId) {
      if (confirm('Delete this workout entry? Daily active time will be updated.')) {
        Store.deleteActivity(actId);
        this.showToast('Workout entry deleted.', 'info');
      }
    },

    handleAddSleep(e) {
      e.preventDefault();
      const input = document.getElementById('input-sleep-hours');
      const hours = Number(input.value);
      if (isNaN(hours) || hours <= 0 || hours > 24) {
        this.showToast('Please enter a valid sleep duration (1 to 24 hours).', 'error');
        return;
      }
      Store.updateMetric('sleep', hours, true);
      input.value = '';
      this.closeModal('modal-sleep');
      this.showToast(`Logged ${hours.toFixed(1)} hours of rest!`, 'success');
    },

    fillStepChip(amount) {
      const input = document.getElementById('input-steps-amount');
      if (input) input.value = amount;
    },

    fillWaterChip(amount) {
      const input = document.getElementById('input-water-amount');
      if (input) input.value = amount;
    },

    fillSleepChip(hours) {
      const input = document.getElementById('input-sleep-hours');
      if (input) input.value = hours;
    },

    handleSaveGoals() {
      const s = Number(document.getElementById('input-goal-steps').value);
      const a = Number(document.getElementById('input-goal-activity').value);
      const w = Number(document.getElementById('input-goal-water').value);
      const sl = Number(document.getElementById('input-goal-sleep').value);

      if (s < 1000 || a < 10 || w < 500 || sl < 4) {
        this.showToast('Please enter reasonable target values.', 'error');
        return;
      }

      Store.data.goals.steps = s;
      Store.data.goals.activity = a;
      Store.data.goals.water = w;
      Store.data.goals.sleep = sl;
      Store.save();

      this.onDataChanged();
      this.showToast('🎯 Personal Goals updated successfully!', 'success');
    },

    handleResetGoalsDefault() {
      Store.data.goals = { steps: 8000, water: 2500, activity: 45, sleep: 8.0 };
      Store.save();
      this.renderGoalsPage();
      this.onDataChanged();
      this.showToast('Goals reset to recommended medical defaults.', 'info');
    },

    handleSaveProfile() {
      const input = document.getElementById('settings-input-name');
      const val = input ? input.value.trim() : '';
      if (!val) {
        this.showToast('Please enter a valid name.', 'error');
        return;
      }
      Store.data.profile.name = val;
      Store.save();
      this.renderTopbarAndProfile();
      this.showToast('Profile name updated!', 'success');
    },

    handleConfirmReset() {
      const input = document.getElementById('input-reset-confirm');
      if (input && input.value.trim().toUpperCase() === 'RESET') {
        Store.resetAll();
        input.value = '';
        this.closeModal('modal-reset');
        this.showToast('Application reset to initial state.', 'info');
        this.openModal('modal-onboarding');
      } else {
        this.showToast('Type RESET to confirm deletion.', 'error');
      }
    }
  };

  // Expose to window for inline onclick accessibility
  window.FitPulseApp = FitPulseApp;

  // Initialize on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FitPulseApp.init());
  } else {
    FitPulseApp.init();
  }
})();
