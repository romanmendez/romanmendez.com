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
	getTimeAgo,
	getUserImgSrc,
} from '#app/utils/misc.tsx'
import { useOptionalUser, useUser } from '#app/utils/user'

export async function loader({ params }: LoaderFunctionArgs) {
	const band = await prisma.band.findFirst({
		select: {
			id: true,
			name: true,
			ageGroup: true,
			schedule: true,
			createdAt: true,
			updatedAt: true,
			students: {
				select: {
					id: true,
					name: true,
					dob: true,
					instrument: true,
					image: { select: { id: true } },
					comments: {
						select: {
							id: true,
							content: true,
							author: {
								select: {
									id: true,
									name: true,
									user: { select: { image: { select: { id: true } } } },
								},
							},
							updatedAt: true,
						},
						orderBy: { updatedAt: 'asc' },
						take: 1,
					},
				},
			},
			teachers: {
				select: {
					id: true,
					name: true,
					user: { select: { id: true, image: { select: { id: true } } } },
				},
			},
		},
		where: {
			id: params.id,
		},
	})
	invariantResponse(band, 'User not found', { status: 404 })

	return json({
		band,
	})
}

export default function StudentProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const band = data.band
	const loggedInUser = useOptionalUser()

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="w-100 relative">
					<div className="flex -space-x-10 overflow-hidden">
						{band.students.map(student => (
							<img
								key={student.id}
								alt={student.name}
								src={getStudentImgSrc(student.image?.id)}
								className="h-30 w-30 inline-block rounded-full ring-2 ring-white"
							/>
						))}
					</div>
				</div>

				<Spacer size="4xs" />

				<div className="flex flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{band.name}</h1>
					</div>
					<p className="mt-2 text-center text-muted-foreground">
						Joined {data.band.createdAt}
					</p>
					<div className="mt-10 flex gap-4">
						<Button asChild>
							<Link to="notes" prefetch="intent">
								My notes
							</Link>
						</Button>
						{loggedInUser ? (
							<Button asChild>
								<Link to="/settings/profile" prefetch="intent">
									Edit profile
								</Link>
							</Button>
						) : null}
					</div>
				</div>
				<ul className="divide-y divide-gray-100">
					{band.students.map(student => (
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
								<ul className="px-20">
									{student.comments.map(comment => (
										<li
											key={comment.id}
											role="article"
											className="relative pl-8"
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

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.band.name ?? params.username
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
