import { invariantResponse } from '@epic-web/invariant'
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getStudentImgSrc, useDelayedIsPending } from '#app/utils/misc.tsx'

const CURRENT_ROUTE = '/bands'

export async function loader({ request }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') {
		return redirect(CURRENT_ROUTE)
	}

	const like = `%${searchTerm ?? ''}%`
	const bands = await prisma.band.findMany({
		select: {
			id: true,
			name: true,
			ageGroup: true,
			schedule: true,
			students: {
				select: { id: true, name: true, image: { select: { id: true } } },
			},
			teachers: {
				select: { name: true },
			},
		},
		where: {
			name: { contains: like },
		},
	})

	invariantResponse(bands, 'No students found', { status: 404 })

	return json({ status: 'idle', bands } as const)
}

export default function StudentRoute() {
	const data = useLoaderData<typeof loader>()
	const formAction = CURRENT_ROUTE
	const bands = data.bands
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction,
	})

	return (
		<div className="container mb-5 mt-5 flex flex-col items-center justify-center gap-6">
			<div className="w-full max-w-[700px] ">
				<SearchBar
					status={data.status}
					formAction={formAction}
					autoFocus
					autoSubmit
				/>
			</div>
			<main>
				{data.status === 'idle' ? (
					bands.length ? (
						<ul
							className={cn('divide-y divide-muted-foreground', {
								'opacity-50': isPending,
							})}
						>
							{bands.map(band => (
								<li key={band.id} className="flex gap-x-1 py-5">
									<Link
										to={band.id}
										className="grid grid-flow-col justify-stretch"
									>
										<div className="mr-5 flex -space-x-2">
											{band.students.map(student => (
												<img
													key={student.id}
													alt={student.name}
													src={getStudentImgSrc(student.image?.id)}
													className="inline-block h-10 w-10 rounded-full ring-2 ring-white"
												/>
											))}
										</div>
										<div className="min-w-0 flex-auto">
											<p className="text-sm font-semibold leading-6 text-foreground">
												{band.name}
											</p>
											<p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
												{band.students.map(s => s.name).join(', ')}
											</p>
										</div>
										<div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
											<p className="text-sm leading-6 text-gray-900 text-muted-foreground">
												{band.teachers.map(t => t.name).join(', ')}
											</p>
											<p className="mt-1 text-xs leading-5 text-gray-500">
												Last seen
											</p>
										</div>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p>No users found</p>
					)
				) : data.status === 'error' ? (
					<ErrorList errors={['There was an error parsing the results']} />
				) : null}
			</main>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
