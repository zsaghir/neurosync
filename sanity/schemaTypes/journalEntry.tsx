import { ComposeIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

const wallOfAwfulOptions = [
  {title: 'Overwhelm', value: 'overwhelm'},
  {title: 'Fear', value: 'fear'},
  {title: 'Confusion', value: 'confusion'},
  {title: 'Discouragement', value: 'discouragement'},
  {title: 'Hopelessness', value: 'hopelessness'},
] as const

const ratingField = (name: 'energy_level' | 'focus_rating', label: string) =>
  defineField({
    name,
    title: label,
    type: 'number',
    options: {
      list: [
        {title: '1', value: 1},
        {title: '2', value: 2},
        {title: '3', value: 3},
        {title: '4', value: 4},
        {title: '5', value: 5},
      ],
      layout: 'radio',
    },
    validation: (rule) => rule.required().integer().min(1).max(5),
  })

export const journalEntry = defineType({
  name: 'journalEntry',
  title: 'Journal entry',
  type: 'document',
  icon: ComposeIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: 'block_content',
      title: 'Entry',
      type: 'array',
      of: [defineArrayMember({type: 'block'})],
      description: 'Rich text body for this journal entry.',
    }),
    defineField({
      name: 'quick_capture',
      title: 'Quick capture',
      type: 'boolean',
      description: 'Short, in-the-moment note rather than a full journal session.',
      initialValue: false,
    }),
    defineField({
      name: 'mood_rating',
      title: 'Mood',
      type: 'number',
      description: 'How you felt when writing this entry.',
      options: {
        list: [
          {title: '😫 Very low', value: 1},
          {title: '😕 Low', value: 2},
          {title: '😐 Neutral', value: 3},
          {title: '🙂 Good', value: 4},
          {title: '😄 Great', value: 5},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required().integer().min(1).max(5),
    }),
    ratingField('energy_level', 'Energy level'),
    ratingField('focus_rating', 'Focus'),
    defineField({
      name: 'wall_of_awful',
      title: 'Wall of awful',
      type: 'array',
      description: 'Feelings or states showing up in this entry.',
      of: [
        defineArrayMember({
          type: 'string',
          options: {
            list: [...wallOfAwfulOptions],
            layout: 'dropdown',
          },
        }),
      ],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'wins',
      title: 'Wins',
      type: 'array',
      description: 'Accomplishments or bright spots for this entry.',
      of: [defineArrayMember({type: 'string', title: 'Win'})],
    }),
    defineField({
      name: 'ai_generated_category',
      title: 'AI-generated category',
      type: 'reference',
      to: [{type: 'aiGeneratedCategory'}],
      description: 'Category assigned or suggested by your AI pipeline.',
    }),
    defineField({
      name: 'user_id',
      title: 'User ID',
      type: 'string',
      description: 'External user identifier from your auth system.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'entry_date',
      title: 'Entry date',
      type: 'date',
      description: 'Calendar day this entry is for.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'created_at',
      title: 'Created at',
      type: 'datetime',
      description: 'When this entry was first saved.',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      entry_date: 'entry_date',
      mood: 'mood_rating',
      categoryTitle: 'ai_generated_category.title',
    },
    prepare({title, entry_date, mood, categoryTitle}) {
      const moodEmoji =
        mood === 1
          ? '😫'
          : mood === 2
            ? '😕'
            : mood === 3
              ? '😐'
              : mood === 4
                ? '🙂'
                : mood === 5
                  ? '😄'
                  : ''
      const parts = [entry_date, moodEmoji, categoryTitle].filter(Boolean)
      return {
        title: title || 'Untitled',
        subtitle: parts.join(' · '),
      }
    },
  },
})
