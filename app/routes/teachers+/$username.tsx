import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getStudentAge,
	getStudentImgSrc,
	getUserImgSrc,
} from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user'

export async function loader({ params }: LoaderFunctionArgs) {
	const teacher = await prisma.user.findFirst({
		select: {
			id: true,
			name: true,
			username: true,
			createdAt: true,
			image: { select: { id: true } },
			lessons: {
				select: {
					id: true,
					instrument: true,
					updatedAt: true,
					student: {
						select: {
							name: true,
							username: true,
							dob: true,
							image: { select: { id: true } },
						},
					},
				},
			},
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(teacher, 'Teacher not found', { status: 404 })

	return json({
		teacher,
		userJoinedDisplay: teacher.createdAt.toLocaleDateString(),
	})
}

export default function TeacherProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const teacher = data.teacher
	const lessons = data.teacher.lessons
	const teacherDisplayName = teacher.name ?? teacher.username
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = data.teacher.id === loggedInUser?.id

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="relative w-52">
					<div className="absolute -top-40">
						<div className="relative">
							<img
								src={getUserImgSrc(teacher.image?.id)}
								alt={teacherDisplayName}
								className="h-52 w-52 rounded-full object-cover"
							/>
						</div>
					</div>
				</div>

				<Spacer size="sm" />

				<div className="flex flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{teacherDisplayName}</h1>
					</div>
					<p className="mt-2 text-center text-muted-foreground">
						Joined {data.userJoinedDisplay}
					</p>
					<div className="mt-10 flex gap-4">
						<Button asChild>
							<Link to="notes" prefetch="intent">
								My notes
							</Link>
						</Button>
						{isLoggedInUser ? (
							<Button asChild>
								<Link to="/settings/profile" prefetch="intent">
									Edit profile
								</Link>
							</Button>
						) : null}
					</div>
				</div>
				<ul className="divide-y divide-gray-100">
					{lessons.map(lesson => (
						<Link
							key={lesson.id}
							to={`/students/${lesson.student.username}`}
							prefetch="intent"
						>
							<li className="flex justify-between gap-x-6 py-5">
								<div className="flex min-w-0 gap-x-4">
									<img
										className="h-12 w-12 flex-none rounded-full bg-gray-50"
										src={getStudentImgSrc(lesson.student.image?.id)}
										alt=""
									/>
									<div className="min-w-0 flex-auto">
										<p className="text-sm font-semibold leading-6 text-foreground">
											{lesson.student.name}
										</p>
										<p className="mt-1 truncate text-xs leading-5 text-gray-500">
											{getStudentAge(lesson.student.dob)} years old
										</p>
									</div>
								</div>
								<div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
									<p className="text-sm leading-6 text-foreground">
										{lesson.instrument}
									</p>
									{lesson.updatedAt ? (
										<p className="mt-1 text-xs leading-5 text-gray-500">
											Last seen{' '}
											<time dateTime={lesson.updatedAt}>
												{lesson.updatedAt}
											</time>
										</p>
									) : (
										<div className="mt-1 flex items-center gap-x-1.5">
											<div className="flex-none rounded-full bg-emerald-500/20 p-1">
												<div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
											</div>
											<p className="text-xs leading-5 text-gray-500">Online</p>
										</div>
									)}
								</div>
							</li>
						</Link>
					))}
				</ul>
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.teacher.name ?? params.username
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
