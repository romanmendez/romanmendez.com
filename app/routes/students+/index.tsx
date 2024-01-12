import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getStudentImgSrc, useDelayedIsPending } from '#app/utils/misc.tsx'

const StudentSearchResultSchema = z.object({
	id: z.string(),
	instrument: z.string(),
	username: z.string(),
	name: z.string().nullable(),
	imageId: z.string().nullable(),
})

const StudentSearchResultsSchema = z.array(StudentSearchResultSchema)

export async function loader({ request }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') {
		return redirect('/students')
	}

	const like = `%${searchTerm ?? ''}%`
	const rawStudents = await prisma.$queryRaw`
		SELECT Student.id, Student.username, Student.instrument, Student.name, StudentImage.id AS imageId
		FROM Student
		LEFT JOIN StudentImage ON Student.id = StudentImage.studentId
		WHERE Student.username LIKE ${like}
		OR Student.name LIKE ${like}
		LIMIT 50
	`

	const result = StudentSearchResultsSchema.safeParse(rawStudents)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}
	return json({ status: 'idle', students: result.data } as const)
}

export default function StudentRoute() {
	const data = useLoaderData<typeof loader>()
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/students',
	})

	if (data.status === 'error') {
		console.error(data.error)
	}

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<h1 className="text-h1">School of Rock Students</h1>
			<div className="w-full max-w-[700px] ">
				<SearchBar status={data.status} autoFocus autoSubmit />
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
										to={student.username}
										className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-5 py-3"
									>
										<img
											alt={student.name ?? student.username}
											src={getStudentImgSrc(student.imageId)}
											className="h-16 w-16 rounded-full"
										/>
										{student.name ? (
											<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
												{student.name}
											</span>
										) : null}
										<span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
											{student.instrument}
										</span>
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
