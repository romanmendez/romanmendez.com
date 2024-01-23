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
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<h1 className="text-h1">Bands</h1>
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
							className={cn('divide-y divide-gray-100', {
								'opacity-50': isPending,
							})}
						>
							{bands.map(band => (
								<li key={band.id} className="flex justify-between gap-x-6 py-5">
									<Link to={band.id} className="flex min-w-0 gap-x-4">
										<div className="flex -space-x-2 overflow-hidden">
											{band.students.map(student => (
												<img
													key={student.id}
													alt={student.name}
													src={getStudentImgSrc(student.image?.id)}
													className="inline-block h-10 w-10 rounded-full ring-2 ring-white"
												/>
											))}
										</div>
										<div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
											<p className="text-sm leading-6 text-gray-900 text-muted-foreground">
												{band.name}
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
