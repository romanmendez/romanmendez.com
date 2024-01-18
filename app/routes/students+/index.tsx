import { invariantResponse } from '@epic-web/invariant'
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getStudentImgSrc, useDelayedIsPending } from '#app/utils/misc.tsx'

const CURRENT_ROUTE = '/students'

export async function loader({ request }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') {
		return redirect(CURRENT_ROUTE)
	}

	const like = `%${searchTerm ?? ''}%`
	const students = await prisma.student.findMany({
		select: {
			id: true,
			name: true,
			image: { select: { id: true } },
		},
		where: {
			name: { contains: like },
		},
	})

	invariantResponse(students, 'No students found', { status: 404 })

	return json({ status: 'idle', students } as const)
}

export default function StudentRoute() {
	const data = useLoaderData<typeof loader>()
	const formAction = CURRENT_ROUTE
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction,
	})

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<h1 className="text-h1">School of Rock Students</h1>
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
					data.students.length ? (
						<ul
							className={cn(
								'flex w-full flex-wrap items-center justify-center gap-4 delay-200',
								{ 'opacity-50': isPending },
							)}
						>
							{data.students.map(student => (
								<li key={student.id}>
									<Link
										to={student.id}
										className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-5 py-3"
									>
										<img
											alt={student.name}
											src={getStudentImgSrc(student.image?.id)}
											className="h-16 w-16 rounded-full"
										/>
										{student.name ? (
											<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
												{student.name}
											</span>
										) : null}
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
