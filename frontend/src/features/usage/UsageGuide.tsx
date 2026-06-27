"use client";

import {
  FolderOpen,
  Building2,
  CalendarHeart,
  LayoutDashboard,
  ListTodo,
  SquareKanban,
  Rocket,
  Trello,
  Calendar,
  Clock,
  Repeat2,
  Timer,
  Network,
  FileText,
  Target,
  BarChart3,
  Trash2,
} from "lucide-react";

interface Section {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  steps: string[];
}

interface Group {
  heading: string;
  description: string;
  sections: Section[];
}

const GROUPS: Group[] = [
  {
    heading: "Getting started",
    description:
      "Everything is organised under organizations and projects. Use the switcher at the top of the sidebar to scope what you see.",
    sections: [
      {
        icon: Building2,
        title: "Organizations",
        blurb: "Top-level grouping that owns your projects.",
        steps: [
          "Create an organization to group related projects (e.g. Work, Personal).",
          "Projects can be assigned to an organization when created or edited.",
        ],
      },
      {
        icon: FolderOpen,
        title: "Projects & the switcher",
        blurb: "Most pages are scoped to the project selected in the sidebar switcher.",
        steps: [
          "Pick a project in the switcher to scope Board, Backlog, Sprints, Work Items, Docs, and Calendar to it.",
          "Choose “All projects” to see items across every project.",
          "Open Projects to create, edit, color, or link a project to a Goal.",
        ],
      },
    ],
  },
  {
    heading: "Plan & track work",
    description: "The agile toolkit — capture, prioritise, and ship work items.",
    sections: [
      {
        icon: Trello,
        title: "Work Items",
        blurb: "The full list of tasks/stories/bugs and more.",
        steps: [
          "Create a work item and pick a Type: task, story, epic, feat, fix, bug, debug, docs, revert, deploy, release, milestone, or habit.",
          "Open an item to edit its Type, Priority, Assignee, Sprint, Story points, dates, links, and subtasks inline.",
          "Filter the list by type, status, or priority.",
        ],
      },
      {
        icon: ListTodo,
        title: "Backlog",
        blurb: "Unsprinted work, scoped to the current project.",
        steps: [
          "Add and groom items; filter by type/priority.",
          "From a sprint's Planning tab, pull backlog items into the sprint.",
        ],
      },
      {
        icon: SquareKanban,
        title: "Board",
        blurb: "Kanban view of the active work.",
        steps: [
          "Drag cards between columns (Backlog → To Do → In Progress → In Review → Done).",
          "Filter by type, priority, or sprint.",
          "Click a card to open the detail panel and change Type, Priority, etc.",
        ],
      },
      {
        icon: Rocket,
        title: "Sprints",
        blurb: "Time-boxed iterations with capacity and burndown.",
        steps: [
          "Plan: pull backlog items in (capacity is tracked by story points).",
          "Activate to start; use Stop Sprint to return it to planning, or Complete Sprint to close it.",
          "Track Overview, Burndown, Review, and Retrospective; filter the overview by type.",
        ],
      },
      {
        icon: Network,
        title: "Hierarchy",
        blurb: "See how initiatives → epics → work items nest.",
        steps: ["Browse the tree to understand parent/child relationships and roll-ups."],
      },
      {
        icon: Target,
        title: "Goals",
        blurb: "High-level objectives broken down into projects and tasks.",
        steps: [
          "Create a goal, then link projects to it.",
          "Each goal shows a progress bar rolled up from its projects' tasks.",
        ],
      },
    ],
  },
  {
    heading: "Your time & routines",
    description: "Personal planning that lives at the user level, independent of any project.",
    sections: [
      {
        icon: CalendarHeart,
        title: "Life Calendar",
        blurb: "A Notion-style personal calendar for events and time blocks.",
        steps: [
          "Switch Day / Week / Month; toggle Sun/Mon as the first day of the week.",
          "Click-and-drag on an empty slot to create an event; drag an event to reschedule it.",
          "New Event supports recurrence (daily / weekly / monthly / custom weekdays, ending never or after N times).",
          "Calendars: create coloured categories, assign an event to one or more — the event inherits the calendar colour.",
          "Delete options: a single event, only this occurrence, this and future occurrences, remove from a calendar, or delete a calendar.",
        ],
      },
      {
        icon: Calendar,
        title: "Calendar (project task timeline)",
        blurb: "Your project tasks laid out by due date.",
        steps: [
          "Create on empty space, click a task to edit, or drag to reschedule its due date.",
          "Unscheduled tasks sit in the side panel — drag them onto a day.",
        ],
      },
      {
        icon: Clock,
        title: "Time Blocking",
        blurb: "Block out your day and link blocks to tasks.",
        steps: [
          "Create blocks (New block or drag on the grid) and link a task to show its title.",
          "Used as the basis for Focus sessions.",
        ],
      },
      {
        icon: Repeat2,
        title: "Habits",
        blurb: "Build streaks with daily/weekly/custom habits.",
        steps: [
          "Create check, count, or duration habits with a frequency.",
          "Log each day; streaks and a completion heatmap update automatically and feed Analytics.",
        ],
      },
      {
        icon: Timer,
        title: "Focus",
        blurb: "Pomodoro / Deep Work timer that records sessions.",
        steps: [
          "Pick a mode and Start Focus — a focus time block is created automatically (link a task first to attach it).",
          "Pause / Resume / Finish; finished sessions count toward Analytics and Dashboard stats.",
        ],
      },
    ],
  },
  {
    heading: "Knowledge & insight",
    description: "Document what matters and measure your output.",
    sections: [
      {
        icon: FileText,
        title: "Docs",
        blurb: "Confluence-style spaces and pages, scoped per project.",
        steps: [
          "Create a Space (assign it to a project or keep it under All projects).",
          "Add pages, databases, and link them; only the chosen project sees its spaces.",
        ],
      },
      {
        icon: LayoutDashboard,
        title: "Dashboard",
        blurb: "Your daily overview.",
        steps: [
          "See the active sprint, overdue items, today's tasks, habits, and focus time at a glance.",
        ],
      },
      {
        icon: BarChart3,
        title: "Analytics",
        blurb: "Trends across tasks, habits, focus, and sprints.",
        steps: [
          "Pick a date range; metrics accumulate automatically as you complete tasks, log habits, and run focus sessions.",
        ],
      },
      {
        icon: Trash2,
        title: "Trash",
        blurb: "Recover deleted items.",
        steps: ["Restore or permanently remove soft-deleted items."],
      },
    ],
  },
];

export function UsageGuide() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">How to use ManageMyLife</h1>
        <p className="text-sm text-muted-foreground">
          A quick tour of every feature. Tip: the project switcher at the top of the
          sidebar scopes most pages — choose “All projects” to see everything.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.heading} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{group.heading}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.sections.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{s.blurb}</p>
                  <ul className="mt-3 space-y-1.5">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
