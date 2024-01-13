import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getStudentImgSrc, getUserImgSrc } from '#app/utils/misc.tsx'
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
					student: {
						select: {
							name: true,
							username: true,
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
				<main>
					{lessons.length ? (
						<ul
							className={
								'flex w-full flex-wrap items-center justify-center gap-4 delay-200'
							}
						>
							{lessons.map(lesson => (
								<li key={lesson.id}>
									<Link
										to={`/students/${lesson.student.username}`}
										className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-5 py-3"
									>
										<img
											alt={lesson.student.name ?? lesson.student.username}
											src={getStudentImgSrc(lesson.student.image?.id)}
											className="h-16 w-16 rounded-full"
										/>
										<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
											{lesson.student.name}
										</span>
										<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
											{lesson.instrument}
										</span>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p>No classes found</p>
					)}
				</main>
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
