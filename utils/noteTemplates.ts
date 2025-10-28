import type { NoteTemplate } from '~/types/noteTemplate';

/**
 * Note Templates
 * 
 * This file contains all available note templates for the application.
 * To add a new template, simply add a new object to the array following the NoteTemplate interface.
 * 
 * Template Structure:
 * - id: unique identifier (kebab-case)
 * - title: display name for the template
 * - icon: Heroicon name (e.g., 'i-heroicons-users')
 * - color: Tailwind gradient classes (e.g., 'from-blue-500 to-blue-600')
 * - description: brief description of the template's purpose
 * - content: HTML content for the note (supports full TipTap formatting)
 * - category: optional category for grouping templates
 */

export const noteTemplates: NoteTemplate[] = [
  {
    id: 'meeting-notes',
    title: 'Meeting Notes',
    icon: 'i-heroicons-users',
    color: 'from-blue-500 to-blue-600',
    description: 'Structure for meeting minutes',
    category: 'productivity',
    content: `<h2>Meeting Notes</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Attendees:</strong></p>
<ul>
  <li><p></p></li>
</ul>
<h3>Agenda</h3>
<ol>
  <li><p></p></li>
</ol>
<h3>Discussion Points</h3>
<p></p>
<h3>Action Items</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>
<h3>Next Steps</h3>
<p></p>`
  },
  {
    id: 'daily-journal',
    title: 'Daily Journal',
    icon: 'i-heroicons-book-open',
    color: 'from-purple-500 to-purple-600',
    description: 'Daily reflection and planning',
    category: 'personal',
    content: `<h2>Daily Journal - ${new Date().toLocaleDateString()}</h2>
<h3>🌅 Morning Thoughts</h3>
<p></p>
<h3>✅ Today's Goals</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
  <li data-type="taskItem" data-checked="false"><p></p></li>
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>
<h3>📝 What Happened Today</h3>
<p></p>
<h3>💡 Key Learnings</h3>
<p></p>
<h3>🙏 Gratitude</h3>
<ul>
  <li><p></p></li>
  <li><p></p></li>
  <li><p></p></li>
</ul>`
  },
  {
    id: 'project-plan',
    title: 'Project Plan',
    icon: 'i-heroicons-clipboard-document-list',
    color: 'from-green-500 to-green-600',
    description: 'Organize project details',
    category: 'productivity',
    content: `<h2>Project Plan</h2>
<p><strong>Project Name:</strong></p>
<p><strong>Start Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Target Completion:</strong></p>
<h3>Project Overview</h3>
<p></p>
<h3>Objectives</h3>
<ol>
  <li><p></p></li>
  <li><p></p></li>
  <li><p></p></li>
</ol>
<h3>Milestones</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>
<h3>Resources Needed</h3>
<p></p>
<h3>Risks & Mitigation</h3>
<p></p>`
  },
  {
    id: 'study-notes',
    title: 'Study Notes',
    icon: 'i-heroicons-academic-cap',
    color: 'from-indigo-500 to-indigo-600',
    description: 'Learning and revision notes',
    category: 'learning',
    content: `<h2>Study Notes</h2>
<p><strong>Subject:</strong></p>
<p><strong>Topic:</strong></p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<h3>📚 Key Concepts</h3>
<ul>
  <li><p></p></li>
  <li><p></p></li>
</ul>
<h3>📝 Detailed Notes</h3>
<p></p>
<h3>💡 Important Points</h3>
<blockquote><p></p></blockquote>
<h3>❓ Questions to Review</h3>
<ol>
  <li><p></p></li>
</ol>
<h3>🔗 Resources</h3>
<ul>
  <li><p></p></li>
</ul>`
  },
  {
    id: 'recipe',
    title: 'Recipe',
    icon: 'i-heroicons-cake',
    color: 'from-orange-500 to-orange-600',
    description: 'Cooking recipes and instructions',
    category: 'personal',
    content: `<h2>Recipe Name</h2>
<p><strong>Prep Time:</strong> </p>
<p><strong>Cook Time:</strong> </p>
<p><strong>Servings:</strong> </p>
<h3>Ingredients</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>
<h3>Instructions</h3>
<ol>
  <li><p></p></li>
</ol>
<h3>Notes</h3>
<p></p>
<h3>Variations</h3>
<p></p>`
  },
  {
    id: 'bug-report',
    title: 'Bug Report',
    icon: 'i-heroicons-bug-ant',
    color: 'from-red-500 to-red-600',
    description: 'Track software bugs',
    category: 'productivity',
    content: `<h2>Bug Report</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Priority:</strong> 🔴 High / 🟡 Medium / 🟢 Low</p>
<p><strong>Status:</strong> Open</p>
<h3>Description</h3>
<p></p>
<h3>Steps to Reproduce</h3>
<ol>
  <li><p></p></li>
  <li><p></p></li>
</ol>
<h3>Expected Behavior</h3>
<p></p>
<h3>Actual Behavior</h3>
<p></p>
<h3>Screenshots/Logs</h3>
<p></p>
<h3>Environment</h3>
<ul>
  <li><p>Browser/Device:</p></li>
  <li><p>OS:</p></li>
  <li><p>Version:</p></li>
</ul>`
  },
  {
    id: 'book-summary',
    title: 'Book Summary',
    icon: 'i-heroicons-book-open',
    color: 'from-teal-500 to-teal-600',
    description: 'Summarize books you read',
    category: 'learning',
    content: `<h2>Book Summary</h2>
<p><strong>Title:</strong></p>
<p><strong>Author:</strong></p>
<p><strong>Date Read:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Rating:</strong> ⭐⭐⭐⭐⭐</p>
<h3>📖 Overview</h3>
<p></p>
<h3>🎯 Key Takeaways</h3>
<ul>
  <li><p></p></li>
  <li><p></p></li>
  <li><p></p></li>
</ul>
<h3>💬 Favorite Quotes</h3>
<blockquote><p></p></blockquote>
<h3>🤔 My Thoughts</h3>
<p></p>
<h3>✅ Action Items</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>`
  },
  {
    id: 'travel-plan',
    title: 'Travel Planner',
    icon: 'i-heroicons-map',
    color: 'from-cyan-500 to-cyan-600',
    description: 'Plan your trips',
    category: 'personal',
    content: `<h2>Travel Plan</h2>
<p><strong>Destination:</strong></p>
<p><strong>Dates:</strong> ${new Date().toLocaleDateString()} - </p>
<p><strong>Travel Companions:</strong></p>
<h3>✈️ Transportation</h3>
<ul>
  <li><p>Outbound:</p></li>
  <li><p>Return:</p></li>
</ul>
<h3>🏨 Accommodation</h3>
<p></p>
<h3>📍 Places to Visit</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>
<h3>🍽️ Restaurants to Try</h3>
<ul>
  <li><p></p></li>
</ul>
<h3>💰 Budget</h3>
<p></p>
<h3>📋 Packing List</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>`
  },
  {
    id: 'workout-log',
    title: 'Workout Log',
    icon: 'i-heroicons-heart',
    color: 'from-pink-500 to-pink-600',
    description: 'Track your fitness routine',
    category: 'health',
    content: `<h2>Workout Log</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Type:</strong> Strength / Cardio / Mixed</p>
<p><strong>Duration:</strong></p>
<h3>🏋️ Exercises</h3>
<table>
  <thead>
    <tr>
      <th>Exercise</th>
      <th>Sets</th>
      <th>Reps</th>
      <th>Weight</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>
<h3>💪 How I Felt</h3>
<p></p>
<h3>📈 Progress Notes</h3>
<p></p>
<h3>🎯 Next Session Goals</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p></p></li>
</ul>`
  },
  {
    id: 'weekly-review',
    title: 'Weekly Review',
    icon: 'i-heroicons-calendar-days',
    color: 'from-violet-500 to-violet-600',
    description: 'Weekly reflection and planning',
    category: 'personal',
    content: `<h2>Weekly Review</h2>
<p><strong>Week of:</strong> ${new Date().toLocaleDateString()}</p>
<h3>🎉 Wins This Week</h3>
<ul>
  <li><p></p></li>
  <li><p></p></li>
  <li><p></p></li>
</ul>
<h3>📊 Progress on Goals</h3>
<p></p>
<h3>🤔 Challenges Faced</h3>
<p></p>
<h3>💡 Lessons Learned</h3>
<ul>
  <li><p></p></li>
</ul>
<h3>🎯 Next Week's Priorities</h3>
<ol>
  <li><p></p></li>
  <li><p></p></li>
  <li><p></p></li>
</ol>
<h3>⚖️ Work-Life Balance</h3>
<p>Rate: ⭐⭐⭐⭐⭐</p>
<p></p>`
  }
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: NoteTemplate['category']): NoteTemplate[] {
  return noteTemplates.filter(template => template.category === category);
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): NoteTemplate | undefined {
  return noteTemplates.find(template => template.id === id);
}

/**
 * Get all available template categories
 */
export function getTemplateCategories(): string[] {
  const categories = new Set(
    noteTemplates
      .map(t => t.category)
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
  );
  return Array.from(categories);
}

