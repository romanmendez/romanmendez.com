import { faker } from '@faker-js/faker'
import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import {
	ageGroupingArray,
	cleanupDb,
	createPassword,
	createSong,
	createStudent,
	createUser,
	getStudentImages,
	getUserImages,
	img,
} from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'

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

	const totalUsers = 5
	console.time(`👤 Created ${totalUsers} users...`)
	const userImages = await getUserImages()

	for (let index = 0; index < totalUsers; index++) {
		const userData = createUser()
		await prisma.user
			.create({
				select: { id: true },
				data: {
					...userData,
					password: { create: createPassword(userData.username) },
					image: { create: userImages[index % userImages.length] },
					roles: { connect: { name: 'teacher' } },
				},
			})
			.catch(e => {
				console.error('Error creating a user:', e)
				return null
			})
	}
	console.timeEnd(`👤 Created ${totalUsers} users...`)

	const totalStudents = 50
	console.time(`🎓 Created ${totalStudents} students...`)
	const studentImages = await getStudentImages()

	for (let index = 0; index < totalStudents; index++) {
		const ageGrouping =
			ageGroupingArray[
				faker.number.int({ min: 0, max: ageGroupingArray.length - 1 })
			]
		const studentData = createStudent({ ageGrouping })
		await prisma.student.create({
			select: { id: true },
			data: {
				...studentData,
				image: { create: studentImages[index % studentImages.length] },
			},
		})
	}
	console.timeEnd(`🎓 Created ${totalStudents} students...`)

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
			students: {
				create: {
					username: 'romanmendez',
					name: 'Roman Mendez',
					dob: faker.date.birthdate({ min: 30, max: 45, mode: 'age' }),
					instrument: 'drums',
				},
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
