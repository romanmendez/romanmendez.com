import { faker } from '@faker-js/faker'
import { type Student } from '@prisma/client'
import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import {
	cleanupDb,
	createPassword,
	createSong,
	createStudent,
	createUser,
	getLessonSchedule,
	img,
} from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'

export const instrumentsArray = ['drums', 'bass', 'keys', 'guitar', 'vocals']
export const ageGroupArray = ['rookie', 'rock101', 'performance', 'adult']
export type Instrument = (typeof instrumentsArray)[number]
export type AgeGroup = (typeof ageGroupArray)[number]

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	await cleanupDb(prisma)
	console.timeEnd('🧹 Cleaned up the database...')

	console.time('🔑 Created permissions...')
	const entities = ['user', 'note']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const
	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				await prisma.permission.create({ data: { entity, action, access } })
			}
		}
	}
	console.timeEnd('🔑 Created permissions...')

	console.time('👑 Created roles...')
	await prisma.role.create({
		data: {
			name: 'admin',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'any' },
				}),
			},
		},
	})
	await prisma.role.create({
		data: {
			name: 'teacher',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'own' },
				}),
			},
		},
	})
	await prisma.role.create({
		data: {
			name: 'student',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'own' },
				}),
			},
		},
	})
	console.timeEnd('👑 Created roles...')

	const totalTeachers = instrumentsArray.length
	console.time(`📚 Created ${totalTeachers} teachers...`)
	const teachers = await Promise.all(
		Array.from({ length: totalTeachers }, async (_, index) => {
			const user = await createUser()
			return await prisma.teacher.create({
				select: { id: true },
				data: {
					name: faker.person.fullName(),
					bio: faker.lorem.paragraph(1),
					instruments: instrumentsArray[index],
					user: {
						create: {
							...user,
							roles: { connect: { name: 'teacher' } },
						},
					},
				},
			})
		}),
	)
	console.timeEnd(`📚 Created ${totalTeachers} teachers...`)

	const totalStudents = instrumentsArray.length + ageGroupArray.length
	console.time(`🎓 Created ${totalStudents} students...`)
	const ageGroupEntries = ageGroupArray.map(a => [a, []])
	const students = Object.fromEntries(ageGroupEntries) as {
		[K in AgeGroup]: Pick<Student, 'id'>[]
	}

	for (let ageGroup in students) {
		const agegroupKey = ageGroup as AgeGroup
		students[agegroupKey] = await Promise.all(
			Array.from({ length: instrumentsArray.length }, async (_, index) => {
				const student = await createStudent({
					ageGroup: agegroupKey,
					instrument: instrumentsArray[index],
				})
				return await prisma.student.create({
					select: { id: true },
					data: { ...student, teacherId: teachers[index].id },
				})
			}),
		)
	}
	console.timeEnd(`🎓 Created ${totalStudents} students...`)

	console.time(`🧂 Created 1 season...`)
	const season = await prisma.season.create({
		select: { id: true },
		data: {
			startDate: faker.date.recent(),
		},
	})
	console.timeEnd(`🧂 Created 1 season...`)

	const totalBands = ageGroupArray.length
	const totalSongs = 5
	const commentsPerSong = 5
	console.time(`🎵 Created ${totalBands} bands...`)
	console.time(`🎵 Created ${totalSongs} songs...`)
	console.time(`🎵 Created ${commentsPerSong} comments per song...`)
	Array.from({ length: totalBands }, async (_, index) => {
		const ageGroup = ageGroupArray[index % ageGroupArray.length]
		const times = getLessonSchedule()
		const schedule = times[index % times.length]
		const bandMembers = students[ageGroup]
		const comments = Array.from({ length: commentsPerSong }, (_, index) => {
			return {
				content: faker.lorem.paragraphs(1),
				authorId: teachers[index].id,
				mentions: { connect: bandMembers[index] },
			}
		})

		const songs = await Promise.all(
			Array.from({ length: totalSongs }, async () => {
				return {
					...createSong(),
					students: {
						connect: bandMembers,
					},
					comments: {
						create: comments,
					},
				}
			}),
		)

		return await prisma.band.create({
			select: { id: true },
			data: {
				name: `${
					ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)
				} ${schedule}`,
				ageGroup,
				schedule,
				setlists: {
					create: {
						theme: faker.music.genre(),
						seasonId: season.id,
						songs: {
							create: songs,
						},
					},
				},
				students: {
					connect: bandMembers,
				},
				teachers: {
					connect: teachers[index % teachers.length],
				},
			},
		})
	})
	console.timeEnd(`🎵 Created ${totalBands} bands...`)
	console.timeEnd(`🎵 Created ${totalSongs} songs...`)
	console.timeEnd(`🎵 Created ${commentsPerSong} comments per song...`)

	console.time(`🐨 Created admin user "kody"`)

	const kodyImages = await promiseHash({
		kodyUser: img({ filepath: './tests/fixtures/images/user/kody.png' }),
		cuteKoala: img({
			altText: 'an adorable koala cartoon illustration',
			filepath: './tests/fixtures/images/kody-notes/cute-koala.png',
		}),
		koalaEating: img({
			altText: 'a cartoon illustration of a koala in a tree eating',
			filepath: './tests/fixtures/images/kody-notes/koala-eating.png',
		}),
		koalaCuddle: img({
			altText: 'a cartoon illustration of koalas cuddling',
			filepath: './tests/fixtures/images/kody-notes/koala-cuddle.png',
		}),
		mountain: img({
			altText: 'a beautiful mountain covered in snow',
			filepath: './tests/fixtures/images/kody-notes/mountain.png',
		}),
		koalaCoder: img({
			altText: 'a koala coding at the computer',
			filepath: './tests/fixtures/images/kody-notes/koala-coder.png',
		}),
		koalaMentor: img({
			altText:
				'a koala in a friendly and helpful posture. The Koala is standing next to and teaching a woman who is coding on a computer and shows positive signs of learning and understanding what is being explained.',
			filepath: './tests/fixtures/images/kody-notes/koala-mentor.png',
		}),
		koalaSoccer: img({
			altText: 'a cute cartoon koala kicking a soccer ball on a soccer field ',
			filepath: './tests/fixtures/images/kody-notes/koala-soccer.png',
		}),
	})

	const githubUser = await insertGitHubUser('MOCK_CODE_GITHUB_KODY')

	await prisma.user.create({
		select: { id: true },
		data: {
			email: 'kody@kcd.dev',
			username: 'kody',
			image: { create: kodyImages.kodyUser },
			teacher: {
				create: {
					instruments: 'drums',
					name: 'Kody',
				},
			},
			password: { create: createPassword('kodylovesyou') },
			connections: {
				create: { providerName: 'github', providerId: githubUser.profile.id },
			},
		},
	})
	console.timeEnd(`🐨 Created admin user "kody"`)

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
