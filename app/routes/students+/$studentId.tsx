import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getStudentAge,
	getStudentImgSrc,
	getTimeAgo,
	getUserImgSrc,
} from '#app/utils/misc.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	const student = await prisma.student.findFirst({
		select: {
			id: true,
			name: true,
			dob: true,
			createdAt: true,
			updatedAt: true,
			image: { select: { id: true } },
			songs: {
				select: {
					id: true,
					title: true,
					artist: true,
					key: true,
					bpm: true,
					updatedAt: true,
					comments: {
						where: { mentions: { some: { id: params.studentId } } },
						select: {
							id: true,
							updatedAt: true,
							content: true,
							author: {
								select: {
									id: true,
									name: true,
									user: { select: { image: { select: { id: true } } } },
								},
							},
						},
						orderBy: { updatedAt: 'desc' },
						take: 5,
					},
				},
			},
			userId: true,
		},
		where: {
			id: params.studentId,
		},
	})
	invariantResponse(student, 'User not found', { status: 404 })

	const studentAge = getStudentAge(student.dob)

	return json({
		student: {
			...student,
			age: studentAge,
		},
		userJoinedDisplay: student.createdAt.toLocaleDateString(),
	})
}

export default function StudentProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const student = data.student
	const songs = data.student.songs

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
				{songs.length
					? songs.map(song => (
							<div key={song.id}>
								<Link to={`/songs/${song.id}`} className="text-h2">
									{song.title}
								</Link>
								<ul
									aria-label="User feed"
									role="feed"
									className="relative flex flex-col gap-12 py-12 pl-8 before:absolute before:left-8 before:top-0 before:h-full before:-translate-x-1/2 before:border before:border-dashed before:border-slate-200 after:absolute after:bottom-6 after:left-8 after:top-6 after:-translate-x-1/2 after:border after:border-slate-200 "
								>
									{song.comments.map(comment => (
										<li
											key={comment.id}
											role="article"
											className="relative pl-8 "
										>
											<div className="flex flex-1 flex-col gap-4">
												<Link to={`/teachers/${comment.author.id}`}>
													<div className="absolute -left-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-white ring-2 ring-white">
														<img
															src={getUserImgSrc(
																comment.author.user?.image?.id,
															)}
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
																says
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
					  ))
					: null}
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
