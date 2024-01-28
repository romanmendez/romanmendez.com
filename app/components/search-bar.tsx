import { Form, useSearchParams, useSubmit } from '@remix-run/react'
import { useId } from 'react'
import { useDebounce } from '#app/utils/misc.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'

export function SearchBar({
	autoFocus = false,
	autoSubmit = false,
	formAction,
}: {
	autoFocus?: boolean
	autoSubmit?: boolean
	formAction: string
}) {
	const id = useId()
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const handleFormChange = useDebounce((form: HTMLFormElement) => {
		submit(form)
	}, 400)

	return (
		<Form
			method="GET"
			action={formAction}
			className="flex w-full flex-wrap items-center justify-center"
			onChange={e => autoSubmit && handleFormChange(e.currentTarget)}
		>
			<div className="flex-1">
				<Label htmlFor={id} className="sr-only">
					Search
				</Label>
				<Input
					type="search"
					name="search"
					id={id}
					defaultValue={searchParams.get('search') ?? ''}
					placeholder="Search"
					className="w-full"
					autoFocus={autoFocus}
				/>
			</div>
		</Form>
	)
}
