import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import {
	cleanupDb,
	createLesson,
	createPassword,
	createSong,
	createStudent,
	createUser,
	getStudentImages,
	img,
} from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'
import { faker } from '@faker-js/faker'
import { Teacher } from '@prisma/client'

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
	console.timeEnd('👑 Created roles...')

	const totalTeachers = 5
	const teachers = []
	console.time(`🎓 Created ${totalTeachers} private classes...`)
	for (let index = 0; index < totalTeachers; index++) {
		const userData = createUser()
		const user = await prisma.user.create({
			select: { id: true, teacher: true },
			data: {
				...userData,
				teacher: {
					create: {
						bio: faker.lorem.paragraph(4),
					},
				},
				roles: { connect: { name: 'teacher' } },
			},
		})
		teachers.push(user)
	}
	console.timeEnd(`🎓 Created ${totalTeachers} private classes...`)

	const totalStudents = 20
	const studentImages = await getStudentImages()
	console.time(`🧑 Created ${totalStudents} students...`)
	for (let index = 0; index < totalStudents; index++) {
		const student = createStudent()
		const image = studentImages[index % studentImages.length]
		const teacher = teachers[index % teachers.length]
		await prisma.student.create({
			data: {
				...student,
				lessons: {
					create: {
						...createLesson(),
						teacherId: teacher.id,
						review: {
							create: {
								content: faker.lorem.paragraph(1),
								authorId: teacher.id,
							},
						},
					},
				},
				image: { create: image },
			},
		})
	}
	console.timeEnd(`🧑 Created ${totalStudents} students...`)

	const totalSongs = 10
	console.time(`🎵 Created ${totalSongs} songs...`)
	for (let index = 0; index < totalSongs; index++) {
		const songData = createSong()
		await prisma.song.create({
			select: { id: true },
			data: {
				...songData,
			},
		})
	}
	console.timeEnd(`🎵 Created ${totalSongs} songs...`)

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
			name: 'Kody',
			image: { create: kodyImages.kodyUser },
			password: { create: createPassword('kodylovesyou') },
			connections: {
				create: { providerName: 'github', providerId: githubUser.profile.id },
			},
			roles: { connect: [{ name: 'admin' }, { name: 'teacher' }] },
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
