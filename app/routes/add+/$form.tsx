import { LoaderFunctionArgs, json } from '@remix-run/server-runtime'
import { prisma } from '#app/utils/db.server'
import { StudentEditor, action } from './__editor'
import { useLoaderData } from '@remix-run/react'

export async function loader({ params }: LoaderFunctionArgs) {
	const form = params.form
	const teachers = await prisma.teacher.findMany({
		select: { id: true, name: true, instruments: true },
	})
	const teacherMap = teachers.map(teacher => {
		const display = `${teacher.name} (${teacher.instruments})`
		return {
			key: teacher.id,
			value: teacher.id,
			display,
		}
	})
	const bands = await prisma.band.findMany({
		select: {
			id: true,
			name: true,
			ageGroup: true,
			students: { select: { name: true, instrument: true } },
		},
	})
	const bandMap = bands.map(band => {
		const totalMembers = band.students.length
		const display = `${band.name} (${totalMembers} members)`
		return {
			key: band.id,
			value: band.id,
			display,
		}
	})
	const instruments = [
		{ key: 'drums', value: 'drums', display: 'drums' },
		{ key: 'bass', value: 'bass', display: 'bass' },
		{ key: 'keys', value: 'keys', display: 'keys' },
		{ key: 'guitar', value: 'guitar', display: 'guitar' },
		{ key: 'vocals', value: 'vocals', display: 'vocals' },
	]
	return json({ teachers: teacherMap, bands: bandMap, instruments, form })
}

export { action }

export default function AddStudentRoute() {
	const data = useLoaderData<typeof loader>()
	switch (data.form) {
		case 'student':
			return <StudentEditor />
	}
}
