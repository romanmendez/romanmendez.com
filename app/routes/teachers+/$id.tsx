import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getStudentAge,
	getUserImgSrc,
	getTimeAgo,
	getStudentImgSrc,
} from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user'

export async function loader({ params }: LoaderFunctionArgs) {
	const teacher = await prisma.teacher.findFirst({
		select: {
			id: true,
			name: true,
			createdAt: true,
			userId: true,
			students: {
				select: {
					id: true,
					name: true,
					dob: true,
					image: { select: { id: true } },
				},
			},
			user: { select: { id: true, image: { select: { id: true } } } },
		},
		where: {
			id: params.id,
		},
	})

	invariantResponse(teacher, 'Teacher not found', { status: 404 })

	const students = await prisma.student.findMany({
		where: {
			teachers: { some: { id: teacher.id } },
		},
		select: {
			id: true,
			name: true,
			dob: true,
			instrument: true,
			updatedAt: true,
			image: { select: { id: true } },
			comments: {
				select: {
					id: true,
					content: true,
					updatedAt: true,
					author: {
						select: {
							name: true,
							id: true,
							user: { select: { image: { select: { id: true } } } },
						},
					},
				},
				take: 1,
				orderBy: {
					createdAt: 'desc',
				},
			},
		},
	})

	return json({
		teacher,
		students,
		userJoinedDisplay: teacher.createdAt.toLocaleDateString(),
	})
}

export default function TeacherProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const teacher = data.teacher
	const students = data.students
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = data.teacher.userId == loggedInUser?.id

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="relative w-52">
					<div className="absolute -top-40">
						<div className="relative">
							<img
								src={getUserImgSrc(teacher.user?.image?.id)}
								alt={teacher.name}
								className="h-52 w-52 rounded-full object-cover"
							/>
						</div>
					</div>
				</div>

				<Spacer size="sm" />

				<div className="flex flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{teacher.name}</h1>
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
					{students.map(student => (
						<Link
							key={student.id}
							to={`/students/${student.id}`}
							prefetch="intent"
						>
							<div>
								<li className="flex justify-between gap-x-6 py-5">
									<div className="flex min-w-0 gap-x-4">
										<img
											className="h-12 w-12 flex-none rounded-full bg-gray-50"
											src={getStudentImgSrc(student.image?.id)}
											alt=""
										/>
										<div className="min-w-0 flex-auto">
											<p className="text-sm font-semibold leading-6 text-foreground">
												{student.name}
											</p>
											<p className="mt-1 truncate text-xs leading-5 text-gray-500">
												{getStudentAge(student.dob)} years old
											</p>
										</div>
									</div>
									<div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
										<p className="text-sm leading-6 text-foreground">
											{student.instrument}
										</p>
									</div>
								</li>
								<ul>
									{student.comments.map(comment => (
										<li
											key={comment.id}
											role="article"
											className="relative pl-8"
										>
											<div className="flex flex-1 flex-col">
												<Link to={`/teachers/${comment.author.id}`}>
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
						</Link>
					))}
				</ul>
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const displayName = data?.teacher.name
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
