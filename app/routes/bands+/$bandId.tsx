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
} from '#app/utils/misc.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	console.log(params)
	const currentSeason = await prisma.season.findFirst({
		select: { id: true },
		where: { OR: [{ endDate: { lt: new Date() } }, { endDate: null }] },
	})
	const band = await prisma.band.findFirst({
		select: {
			id: true,
			name: true,
			ageGroup: true,
			schedule: true,
			createdAt: true,
			updatedAt: true,
			setlists: {
				select: {
					theme: true,
					songs: {
						select: {
							id: true,
							title: true,
							artist: true,
							key: true,
							bpm: true,
						},
					},
				},
				where: {
					seasonId: currentSeason?.id,
				},
				take: 1,
			},
			students: {
				select: {
					id: true,
					name: true,
					dob: true,
					instrument: true,
					image: { select: { id: true } },
					songComments: {
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
			id: params.bandId,
		},
	})
	invariantResponse(band, 'User not found', { status: 404 })
	const [currentSetlist] = band.setlists

	return json({
		band,
		currentSetlist,
	})
}

export default function StudentProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const band = data.band

	return (
		<div className="container mb-5 mt-5 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="w-100 relative">
					<div className="flex -space-x-10">
						{band.students.map(student => (
							<img
								key={student.id}
								alt={student.name}
								src={getStudentImgSrc(student.image?.id)}
								className={` h-1/${band.students.length} w-1/${band.students.length} inline-block rounded-full ring-2 ring-white `}
							/>
						))}
					</div>
				</div>

				<Spacer size="4xs" />

				<div className="flex w-full flex-col ">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{band.name}</h1>
					</div>
					<p className="mt-2 text-center text-muted-foreground">
						Joined {data.band.createdAt}
					</p>

					{data.currentSetlist.songs.map(song => (
						<Link key={song.id} to={`/songs/${song.id}`}>
							<div className="flex justify-evenly border-b border-gray-800 hover:bg-gray-800">
								<div className="w-full p-3">{song.title}</div>
								<div className="w-full p-3">{song.artist}</div>
								<div className="w-full p-3">{song.key}</div>
								<div className="w-12 flex-shrink-0 p-3 text-right">
									{song.bpm}
								</div>
							</div>
						</Link>
					))}
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
											<p className="text-xl font-semibold leading-6 text-foreground">
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
									{student.songComments.map(comment => (
										<li
											key={comment.id}
											role="article"
											className="relative pl-8"
										>
											<div className="flex flex-1 flex-col ">
												<Link to={`/teachers/${comment.author.id}`}>
													<h4 className="flex flex-col items-start text-lg font-medium leading-8 text-slate-700 md:flex-row lg:items-center">
														<span className="flex-1">
															{comment.author.name}
															<span className="text-base font-normal text-slate-500">
																{' '}
																{getTimeAgo(comment.updatedAt)}
															</span>
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
