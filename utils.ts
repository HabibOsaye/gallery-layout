export function debounce(cb: () => void, ms: number = 500) {
	let timeoutID: number

	return (...args: any[]) => {
		clearTimeout(<number>timeoutID)

		timeoutID = setTimeout(() => cb?.apply(null, <[]>args), ms)
	}
}

export function clamp(n: number, min: number, max: number) {
	return n < min ? min : n > max ? max : n
}

export function getBounds(element: HTMLElement) {
	const DOMRect = element.getBoundingClientRect()

	return {
		top: DOMRect.top,
		left: DOMRect.left,
		height: DOMRect.height,
		width: DOMRect.width,
		center() {
			return {
				x: this.left + this.width * 0.5,
				y: this.top + this.height * 0.5,
			}
		},
	}
}

export function inRange(inMin: number, inMax: number | null, targetMin: number, targetMax: number) {
	let isRangeMin = false
	let isRangeMax = false

	if (inMax == null) {
		isRangeMin = inMin >= targetMin
		isRangeMax = inMin <= targetMax
	} else {
		isRangeMin = inMin >= targetMin
		isRangeMax = inMax <= targetMax
	}

	return isRangeMin && isRangeMax
}