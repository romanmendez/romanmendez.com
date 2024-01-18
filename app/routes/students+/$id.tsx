import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import {
	type ActionFunctionArgs,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import {
	Link,
	useLoaderData,
	type MetaFunction,
	Form,
	useActionData,
	useSubmit,
} from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, TextareaField } from '#app/components/forms'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { prisma } from '#app/utils/db.server.ts'
import {
	getStudentAge,
	getStudentImgSrc,
	getTimeAgo,
	getUserImgSrc,
	useIsPending,
} from '#app/utils/misc.tsx'
import { useTeacher } from '#app/utils/user'

export async function loader({ params }: LoaderFunctionArgs) {
	const student = await prisma.student.findFirst({
		select: {
			id: true,
			name: true,
			dob: true,
			createdAt: true,
			updatedAt: true,
			image: { select: { id: true } },
			userId: true,
		},
		where: {
			id: params.id,
		},
	})
	invariantResponse(student, 'User not found', { status: 404 })

	const comments = await prisma.comment.findMany({
		select: {
			id: true,
			content: true,
			updatedAt: true,
			author: {
				select: {
					id: true,
					name: true,
					user: { select: { image: { select: { id: true } } } },
				},
			},
		},
		where: { studentId: student.id },
		orderBy: { updatedAt: 'desc' },
	})
	const studentAge = getStudentAge(student.dob)

	return json({
		student: {
			...student,
			age: studentAge,
		},
		comments,
		userJoinedDisplay: student.createdAt.toLocaleDateString(),
	})
}

const CommentSchema = z.object({
	id: z.string().optional(),
	teacherId: z.string(),
	content: z
		.string({ required_error: 'Please enter a comment before submitting.' })
		.min(1),
})

export async function action({ params, request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const studentId = params.id

	await validateCSRF(formData, request.headers)
	invariantResponse(studentId, 'No student ID was found.')

	const submission = await parse(formData, {
		schema: CommentSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			const comment = await prisma.comment.findUnique({
				select: { id: true },
				where: { id: data.id, authorId: userId },
			})
			if (!comment) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Note not found',
				})
			}
		}),
		async: true,
	})

	console.log('outside delete if', submission)
	if (submission.intent === 'delete-comment') {
		console.log('inside delete if', submission)
		await prisma.comment.deleteMany({
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

	const { id: commentId, content, teacherId } = submission.value

	await prisma.comment.upsert({
		where: { id: commentId ?? '__new_note__' },
		create: {
			studentId,
			authorId: teacherId,
			content,
		},
		update: {
			content,
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

export default function StudentProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const submit = useSubmit()
	const student = data.student
	const comments = data.comments
	const isTeacher = useTeacher()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'comment-editor',
		constraint: getFieldsetConstraint(CommentSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: CommentSchema })
		},
		onSubmit(event) {
			const form = event.currentTarget
			submit(form, {
				navigate: false,
				unstable_flushSync: true,
			})
			const content = form['content'] as unknown as HTMLInputElement
			content.value = ''
		},
	})

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="relative w-52">
					<div className="absolute -top-40">
						<div className="relative">
							<img
								src={getStudentImgSrc(student.image?.id)}
								alt={student.name}
								className="h-52 w-52 rounded-full object-cover"
							/>
						</div>
					</div>
				</div>

				<Spacer size="sm" />

				<div className="flex flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{student.name}</h1>
					</div>
					<p className="mt-2 text-center text-muted-foreground">
						Joined {data.userJoinedDisplay}
					</p>
				</div>
				{isTeacher ? (
					<>
						<div className="mt-10 flex gap-4">
							<Button asChild>
								<Link to="/settings/profile" prefetch="intent">
									Edit profile
								</Link>
							</Button>
						</div>
						<Form method="POST" className="mb-6 mt-4 w-full" {...form.props}>
							<AuthenticityTokenInput />
							<button type="submit" className="hidden" />
							<input
								type="hidden"
								{...conform.input(fields.teacherId)}
								value={isTeacher.id}
							/>
							<div className="mb-4 rounded-lg rounded-t-lg border border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
								<TextareaField
									className="w-full border-0 px-0 text-sm text-gray-900 focus:outline-none focus:ring-0 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									labelProps={{ children: 'Comment' }}
									textareaProps={{ ...conform.textarea(fields.content) }}
									errors={fields.content.errors}
								></TextareaField>
							</div>
							<StatusButton
								status={isPending ? 'pending' : 'idle'}
								type="submit"
							>
								Post review
							</StatusButton>
							<ErrorList id={form.errorId} errors={form.errors} />
						</Form>
					</>
				) : null}
				<ul
					aria-label="User feed"
					role="feed"
					className="relative flex flex-col gap-12 py-12 pl-8 before:absolute before:left-8 before:top-0 before:h-full before:-translate-x-1/2 before:border before:border-dashed before:border-slate-200 after:absolute after:bottom-6 after:left-8 after:top-6 after:-translate-x-1/2 after:border after:border-slate-200 "
				>
					{comments.map(comment => (
						<li key={comment.id} role="article" className="relative pl-8 ">
							<div className="flex flex-1 flex-col gap-4">
								<Link to={`/teachers/${comment.author.id}`}>
									<div className="absolute -left-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-white ring-2 ring-white">
										<img
											src={getUserImgSrc(comment.author.user?.image?.id)}
											alt="user name"
											title="user name"
											width="48"
											height="48"
											className="max-w-full rounded-full"
										/>
									</div>
									<h4 className="flex flex-col items-start text-lg font-medium leading-8 text-slate-700 md:flex-row lg:items-center">
										<span className="flex-1">
											{comment.author.name}
											<span className="text-base font-normal text-slate-500">
												{' '}
												left a lesson comment
											</span>
										</span>
										<span className="text-sm font-normal text-slate-400">
											{' '}
											{getTimeAgo(comment.updatedAt)}
										</span>
									</h4>
								</Link>
								<p className=" text-slate-500">{comment.content}</p>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.student.name ?? params.username
	return [
		{ title: `${displayName} | Epic Notes` },
		{
			name: 'description',
			content: `Profile of ${displayName} on Epic Notes`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	)
}
