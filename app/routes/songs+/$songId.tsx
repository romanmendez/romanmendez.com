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
	useActionData,
	Form,
} from '@remix-run/react'
import { useState } from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, TextareaField } from '#app/components/forms'
import { StatusButton } from '#app/components/ui/status-button'
import { CommentSchema, validateComment } from '#app/utils/comments.server'
import { prisma } from '#app/utils/db.server.ts'
import { getTimeAgo, getUserImgSrc, useIsPending } from '#app/utils/misc'
import { useOptionalUser } from '#app/utils/user'

export async function loader({ params }: LoaderFunctionArgs) {
	const song = await prisma.song.findFirst({
		select: {
			id: true,
			artist: true,
			title: true,
			description: true,
			key: true,
			bpm: true,
			lyrics: true,
			students: {
				select: { id: true, name: true, image: { select: { id: true } } },
			},
			comments: {
				select: {
					id: true,
					content: true,
					updatedAt: true,
					mentions: { select: { id: true, name: true } },
					author: {
						select: {
							id: true,
							name: true,
							user: { select: { image: { select: { id: true } } } },
						},
					},
				},
				orderBy: { updatedAt: 'desc' },
			},
			createdAt: true,
			updatedAt: true,
		},
		where: {
			id: params.songId,
		},
	})

	invariantResponse(song, 'Teacher not found', { status: 404 })

	return json({
		song,
	})
}

export async function action({ request }: ActionFunctionArgs) {
	return await validateComment({ request })
}

export default function SongRoute() {
	const [mentions, setMentions] = useState<Set<string>>(new Set())
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const song = data.song
	const comments = data.song.comments
	const loggedInUser = useOptionalUser()
	const isTeacher = Boolean(loggedInUser?.teacher)
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'comment-editor',
		constraint: getFieldsetConstraint(CommentSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: CommentSchema })
		},
	})

	const handleMentions = (studentId: string) => {
		const newSet = new Set(mentions)
		newSet.has(studentId) ? newSet.delete(studentId) : newSet.add(studentId)
		setMentions(newSet)
	}

	return (
		<div className="container mb-5 mt-5 flex flex-col items-center justify-center">
			<div>
				<div>
					<h1 className="text-center text-h1">{song.title}</h1>
					<h2 className="text-center text-h2">{song.artist}</h2>
				</div>
				<p className="mt-2 text-center text-muted-foreground">
					Added {data.song.createdAt}
				</p>
			</div>
			{isTeacher ? (
				<Form
					key={song.id}
					method="POST"
					className="mb-6 mt-4 w-full"
					{...form.props}
				>
					<AuthenticityTokenInput />
					<button type="submit" className="hidden" />
					<input
						type="hidden"
						{...conform.input(fields.teacherId)}
						value={loggedInUser?.teacher?.id}
					/>
					<input
						type="hidden"
						{...conform.input(fields.mentions)}
						value={Array.from(mentions).join(',')}
					/>
					<input
						type="hidden"
						{...conform.input(fields.songId)}
						value={song.id}
					/>
					<div className="mb-4 rounded-lg rounded-t-lg border border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
						<TextareaField
							className="w-full border-0 px-0 text-sm text-gray-900 focus:outline-none focus:ring-0 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
							labelProps={{ children: 'Comment' }}
							textareaProps={{ ...conform.textarea(fields.content) }}
							errors={fields.content.errors}
						/>
						{song.students.map(student => (
							<button
								type="button"
								key={student.id}
								className={`mr-1 inline-flex items-center rounded-md ${
									mentions.has(student.id)
										? 'bg-gray-50 text-gray-600'
										: 'bg-gray-600 text-gray-50'
								} px-2 py-1 text-xs font-medium  ring-1 ring-inset ring-gray-500/10`}
								onClick={() => handleMentions(student.id)}
							>
								{student.name}
							</button>
						))}
					</div>
					<StatusButton status={isPending ? 'pending' : 'idle'} type="submit">
						Post review
					</StatusButton>
					<ErrorList id={form.errorId} errors={form.errors} />
				</Form>
			) : null}
			{comments.length ? (
				<ul
					aria-label="User feed"
					role="feed"
					className="relative flex flex-col gap-12 py-12 pl-8 before:absolute before:left-8 before:top-0 before:h-full before:-translate-x-1/2 before:border before:border-dashed before:border-slate-200 after:absolute after:bottom-6 after:left-8 after:top-6 after:-translate-x-1/2 after:border after:border-slate-200 "
				>
					{comments.map(comment => (
						<li key={comment.id} role="article" className="relative pl-8 ">
							<div className="flex flex-1 flex-col">
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
								</Link>
								<CommentHeader
									authorName={comment.author.name}
									mentions={comment.mentions}
									updatedAt={comment.updatedAt}
								/>
								<p className=" text-slate-500">{comment.content}</p>
							</div>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}

function CommentHeader({
	authorName,
	mentions,
	updatedAt,
}: {
	authorName: string
	mentions: { id: string; name: string }[]
	updatedAt: string
}) {
	const formatMentions = (i: number) => {
		if (mentions.length === 1) return ''
		if (i === mentions.length - 2) {
			return ' and '
		} else if (i > mentions.length - 2) {
			return ''
		} else {
			return ', '
		}
	}
	return (
		<h4 className="flex flex-col items-start text-lg font-medium leading-8 text-foreground md:flex-row lg:items-center">
			<span className="flex-1">
				{authorName}
				<span className="text-base font-normal text-slate-500"> says </span>
				<span className="text-base font-normal ">
					{mentions.map((m, i) => (
						<>
							<Link
								key={m.id}
								to={`/students/${m.id}`}
								className="text-muted-foreground hover:underline"
							>
								{m.name}
							</Link>
							<span className="text-base font-normal text-slate-500">
								{formatMentions(i)}
							</span>
						</>
					))}
				</span>
				<span className="text-base font-normal text-slate-500">:</span>
			</span>
			<span className="text-sm font-normal text-slate-400">
				{' '}
				{getTimeAgo(updatedAt)}
			</span>
		</h4>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const displayName = data?.song.title
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
