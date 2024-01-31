import {
	conform,
	useFieldset,
	useForm,
	type FieldConfig,
} from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { createId as cuid } from '@paralleldrive/cuid2'
import { type Student, type StudentImage } from '@prisma/client'
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
	type SerializeFrom,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { useRef, useState } from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field, Select } from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getNoteImgSrc, useIsPending } from '#app/utils/misc.tsx'
import { loader } from './student'

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const ImageSchema = z.object({
	id: z.string().optional(),
	file: z
		.instanceof(File)
		.optional()
		.refine(file => {
			return !file || file.size <= MAX_UPLOAD_SIZE
		}, 'File size must be less than 3MB'),
	altText: z.string().optional(),
})

type Image = z.infer<typeof ImageSchema>

function imageHasFile(
	image: Image,
): image is Image & { file: NonNullable<Image['file']> } {
	return Boolean(image.file?.size && image.file?.size > 0)
}

function imageHasId(
	image: Image,
): image is Image & { id: NonNullable<Image['id']> } {
	return image.id != null
}

const StudentEditorSchema = z.object({
	id: z.string().optional(),
	name: z.string(),
	dob: z.date(),
	instrument: z.enum(['drums', 'bass', 'keys', 'guitar', 'vocals']),
	teacherId: z.string(),
	bandId: z.string().optional(),
	image: ImageSchema,
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: StudentEditorSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			const student = await prisma.student.findUnique({
				select: { id: true },
				where: { id: data.id },
			})
			if (!student) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Note not found',
				})
			}
		}).transform(async ({ image, ...data }) => {
			return {
				...data,
				imageUpdate:
					imageHasId(image) && imageHasFile(image)
						? {
								id: image.id,
								altText: image.altText,
								contentType: image.file.type,
								blob: Buffer.from(await image.file.arrayBuffer()),
						  }
						: imageHasId(image)
						  ? {
									id: image.id,
									altText: image.altText,
						    }
						  : undefined,
				newImage:
					!imageHasId(image) && imageHasFile(image)
						? {
								altText: image.altText,
								contentType: image.file.type,
								blob: Buffer.from(await image.file.arrayBuffer()),
						  }
						: undefined,
			}
		}),
		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ submission } as const)
	}

	if (!submission.value) {
		return json({ submission } as const, { status: 400 })
	}

	const {
		id: studentId,
		name,
		dob,
		instrument,
		teacherId,
		bandId,
		newImage,
		imageUpdate,
	} = submission.value

	const updateStudent = await prisma.student.upsert({
		select: { id: true },
		where: { id: studentId ?? '__new_student' },
		create: {
			name,
			dob,
			instrument,
			teacherId,
			bandId,
			image: { create: newImage },
		},
		update: {
			name,
			dob,
			instrument,
			teacherId,
			bandId,
			image: imageUpdate
				? {
						update: {
							where: { id: imageUpdate.id },
							data: {
								...imageUpdate,
								id: imageUpdate.blob ? cuid() : imageUpdate.id,
							},
						},
				  }
				: {
						create: newImage,
				  },
		},
	})

	return redirect(`/students/${updateStudent.id}`)
}

export function StudentEditor({
	student,
}: {
	student?: SerializeFrom<
		Omit<Student, 'updatedAt' | 'createdAt'> & {
			image: Pick<StudentImage, 'id' | 'altText'>
		}
	>
}) {
	const { teachers, bands, instruments } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'student-editor',
		constraint: getFieldsetConstraint(StudentEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			console.log(formData.get('teacherId'))
			return parse(formData, { schema: StudentEditorSchema })
		},
		defaultValue: {
			name: student?.name ?? '',
			dob: student?.dob ?? '',
			instrument: student?.instrument ?? '',
			teacherId: student?.teacherId ?? '',
			bandId: student?.bandId ?? '',
			image: student?.image,
		},
	})

	return (
		<div className="container mb-48 mt-5 flex flex-col items-center justify-center gap-6">
			<Form
				method="POST"
				className="flex h-full w-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				{...form.props}
				encType="multipart/form-data"
			>
				<AuthenticityTokenInput />
				<button type="submit" className="hidden" />
				{student ? <input type="hidden" name="id" value={student.id} /> : null}
				<div className="flex flex-col gap-1">
					<div className="flex justify-center">
						<ImageChooser config={fields.image} />
					</div>
					<Field
						labelProps={{ children: 'Name' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.name, { ariaAttributes: true }),
						}}
						errors={fields.name.errors}
					/>
					<Field
						labelProps={{ children: 'Date of birth' }}
						inputProps={{
							autoFocus: true,
							type: 'date',
							...conform.input(fields.dob, { ariaAttributes: true }),
						}}
						errors={fields.dob.errors}
					/>
					<Select
						labelProps={{ children: 'Instrument' }}
						selectProps={{
							autoFocus: true,
							type: 'text',
							...conform.input(fields.instrument, { ariaAttributes: true }),
						}}
						className="bg-background"
						options={instruments}
						errors={fields.instrument.errors}
					/>
					<Select
						labelProps={{ children: 'Teacher' }}
						selectProps={{
							autoFocus: true,
							type: 'text',
							...conform.input(fields.teacherId, { ariaAttributes: true }),
						}}
						className="bg-background"
						options={teachers}
						errors={fields.teacherId.errors}
					/>
					<Select
						labelProps={{ children: 'Band' }}
						selectProps={{
							autoFocus: true,
							type: 'text',
							...conform.input(fields.bandId, { ariaAttributes: true }),
						}}
						className="bg-background"
						options={bands}
						errors={fields.bandId.errors}
					/>

					<StatusButton
						type="submit"
						disabled={isPending}
						status={isPending ? 'pending' : 'idle'}
					>
						Add Student
					</StatusButton>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
		</div>
	)
}

function ImageChooser({ config }: { config: FieldConfig<Image> }) {
	const ref = useRef<HTMLFieldSetElement>(null)
	const fields = useFieldset(ref, config)
	const existingImage = Boolean(fields.id.defaultValue)
	const [previewImage, setPreviewImage] = useState<string | null>(
		fields.id.defaultValue ? getNoteImgSrc(fields.id.defaultValue) : null,
	)
	return (
		<fieldset
			ref={ref}
			aria-invalid={Boolean(config.errors?.length) || undefined}
			aria-describedby={config.errors?.length ? config.errorId : undefined}
		>
			<div>
				<div className="flex h-32 w-32">
					<Label
						htmlFor={fields.file.id}
						className={cn('group absolute h-32 w-32 rounded-full', {
							'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
								!previewImage,
							'cursor-pointer focus-within:ring-2': !existingImage,
						})}
					>
						{previewImage ? (
							<div className="relative">
								<img
									src={previewImage}
									alt="profile"
									className="h-32 w-32 rounded-lg object-cover"
								/>
								{existingImage ? null : (
									<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
										new
									</div>
								)}
							</div>
						) : (
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted-foreground">
								<Icon
									name="teachers-selected"
									fill="white"
									className="h-6 w-6 text-gray-300"
									aria-hidden="true"
								/>
							</div>
						)}
						{existingImage ? (
							<input
								{...conform.input(fields.id, {
									type: 'hidden',
									ariaAttributes: true,
								})}
							/>
						) : null}
						<input
							aria-label="Image"
							className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
							onChange={event => {
								const file = event.target.files?.[0]

								if (file) {
									const reader = new FileReader()
									reader.onloadend = () => {
										setPreviewImage(reader.result as string)
									}
									reader.readAsDataURL(file)
								} else {
									setPreviewImage(null)
								}
							}}
							accept="image/*"
							{...conform.input(fields.file, {
								type: 'file',
								ariaAttributes: true,
							})}
						/>
					</Label>
				</div>
				<div className="min-h-[32px] px-4 pb-3 pt-1">
					<ErrorList id={fields.file.errorId} errors={fields.file.errors} />
				</div>
			</div>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				<ErrorList id={config.errorId} errors={config.errors} />
			</div>
		</fieldset>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
