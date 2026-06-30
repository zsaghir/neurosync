import {TaskIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

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
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'completed',
      title: 'Completed',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'timeSpentSeconds',
      title: 'Time Spent Seconds',
      type: 'number',
      initialValue: 0,
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'estimatedMinutes',
      title: 'Estimated minutes',
      type: 'number',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'subtasks',
      title: 'Subtasks',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'completed',
              title: 'Completed',
              type: 'boolean',
              initialValue: false,
            }),
          ],
          preview: {
            select: {title: 'title', completed: 'completed'},
            prepare({title, completed}) {
              return {
                title: title || 'Untitled subtask',
                subtitle: completed ? 'Done' : 'Open',
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'alarmAt',
      title: 'Alarm At',
      type: 'datetime',
    }),
    defineField({
      name: 'notificationId',
      title: 'Notification ID',
      type: 'string',
      description: 'Used to cancel alarms.',
    }),
    defineField({
      name: 'userId',
      title: 'User ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'completedAt',
      title: 'Completed At',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      done: 'completed',
      createdAt: 'createdAt',
    },
    prepare({title, done, createdAt}) {
      const bits = [done ? 'Done' : 'Open', createdAt ? `Created ${createdAt}` : null].filter(
        Boolean,
      )
      return {
        title: title || 'Untitled task',
        subtitle: bits.join(' · '),
      }
    },
  },
})
