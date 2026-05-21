import {TaskIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

const rating1To5 = (name: string, title: string) =>
  defineField({
    name,
    title,
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

export const task = defineType({
  name: 'task',
  title: 'Task',
  type: 'document',
  icon: TaskIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [defineArrayMember({type: 'block'})],
      description: 'Rich text details for this task.',
    }),
    rating1To5('difficulty_level', 'Difficulty'),
    defineField({
      name: 'estimated_minutes',
      title: 'Estimated minutes',
      type: 'number',
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({
      name: 'actual_minutes',
      title: 'Actual minutes',
      type: 'number',
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({
      name: 'broken_down_steps',
      title: 'Broken-down steps',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'taskStep',
          title: 'Step',
          fields: [
            defineField({
              name: 'step_text',
              title: 'Step text',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'is_completed',
              title: 'Completed',
              type: 'boolean',
              initialValue: false,
            }),
          ],
          preview: {
            select: {text: 'step_text', done: 'is_completed'},
            prepare({text, done}) {
              return {
                title: text || 'Untitled step',
                subtitle: done ? 'Done' : 'To do',
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'motivation_type',
      title: 'Motivation type',
      type: 'string',
      options: {
        list: [
          {title: 'Urgent', value: 'urgent'},
          {title: 'Novel', value: 'novel'},
          {title: 'Challenging', value: 'challenging'},
          {title: 'Interesting', value: 'interesting'},
        ],
        layout: 'radio',
      },
    }),
    rating1To5('wall_of_awful_rating', 'Wall of awful'),
    defineField({
      name: 'reward',
      title: 'Reward',
      type: 'string',
      description: 'What you get when this task is done.',
    }),
    defineField({
      name: 'is_completed',
      title: 'Completed',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'feedback',
      title: 'Feedback — what was hard',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'user_id',
      title: 'User ID',
      type: 'string',
      description: 'External user identifier from your auth system.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'due_date',
      title: 'Due date',
      type: 'date',
    }),
    defineField({
      name: 'created_at',
      title: 'Created at',
      type: 'datetime',
      description: 'When this task was created.',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      due: 'due_date',
      done: 'is_completed',
      difficulty: 'difficulty_level',
    },
    prepare({title, due, done, difficulty}) {
      const bits = [
        due ? `Due ${due}` : null,
        typeof difficulty === 'number' ? `Difficulty ${difficulty}/5` : null,
        done ? 'Done' : 'Open',
      ].filter(Boolean)
      return {
        title: title || 'Untitled task',
        subtitle: bits.join(' · '),
      }
    },
  },
})
