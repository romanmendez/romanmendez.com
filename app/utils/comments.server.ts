import { parse } from '@conform-to/zod'
import { json } from '@remix-run/node'
import { z } from 'zod'
import { requireUserId } from './auth.server'
import { validateCSRF } from './csrf.server'
import { prisma } from './db.server'

export const CommentSchema = z.object({
	id: z.string().optional(),
	teacherId: z.string(),
	songId: z.string(),
	mentions: z.string(),
	content: z
		.string({ required_error: 'Please enter a comment before submitting.' })
		.min(1),
})

export async function validateComment({ request }: { request: Request }) {
	const userId = await requireUserId(request)
	const formData = await request.formData()

	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: CommentSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			const comment = await prisma.songComment.findUnique({
				select: { id: true },
				where: { id: data.id, authorId: userId },
			})
			if (!comment) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Note not found',
				})
			}
		}).transform(({ mentions, ...data }) => {
			const mentionsArray = mentions.split(',').map(m => ({ id: m }))
			return {
				...data,
				mentions: mentionsArray,
			}
		}),
		async: true,
	})

	if (submission.intent === 'delete-comment') {
		await prisma.songComment.deleteMany({
			where: { id: submission.value?.id },
		})
		return json({ status: 'success', submission } as const)
	}
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const {
		id: commentId,
		content,
		teacherId,
		songId,
		mentions,
	} = submission.value

	await prisma.songComment.upsert({
		where: { id: commentId ?? '__new_note__' },
		create: {
			mentions: { connect: mentions },
			authorId: teacherId,
			songId,
			content,
		},
		update: {
			content,
			mentions: { connect: mentions },
		},
	})
	return json({
		status: 'success',
		submission: {
			...submission,
			payload: null,
		},
	} as const)
}
