import GSAP from 'gsap'

import { inRange, clamp, debounce, getBounds } from './utils'

/**
*
* animation is done using GSAP because i had a problem preventing odd transition overlaps with my previous implementation
* GSAP " overwrite: 'auto' " fixes that problem
*
*/

type RGB = { r: number; g: number; b: number }

type Pose = ( 'list:2' | 'list:1' | 'focus' ) | null

let canvasID = 0
const mediaPadding = 16
const colors: RGB[] = [
	{ r: 190, g: 190, b: 190 },
	{ r: 159, g: 202, b: 165 },
	{ r: 200, g: 161, b: 235 },
	{ r: 245, g: 149, b: 171 },
	{ r: 210, g: 128, b: 194 },
	{ r: 204, g: 184, b: 196 },
	{ r: 181, g: 212, b: 227 },
	{ r: 131, g: 202, b: 157 },
	{ r: 139, g: 150, b: 249 },
	{ r: 128, g: 223, b: 239 },
]

class Canvas2D {
	public viewport: {
		height: number
		width: number
		deltaX: number
		deltaY: number
		scaleX: number
		scaleY: number
		scale: number
		aspectRatio: number
	}

	public canvas: HTMLCanvasElement
	public cxt: CanvasRenderingContext2D
	public isMounted = false

	public constructor( width: number, height: number ) {
		if ( !isCanvasSupported( '2d' ) ) {
			throw new Error( 'Canvas unsupported' )
		}

		this.canvas = <HTMLCanvasElement>document.createElement( 'canvas' )
		this.cxt = <CanvasRenderingContext2D> this.canvas.getContext( '2d' )

		this.viewport = {
			height,
			width,
			deltaX: 0,
			deltaY: 0,
			scaleX: 1,
			scaleY: 1,
			scale: 1,
			aspectRatio: width / height,
		}
	}

	public mount( id?: string, target?: HTMLElement ) {
		if ( this.isMounted ) return

		if ( id ) {
			this.canvas.id = id
		} else {
			this.canvas.id = String( ++canvasID )
		}

		if ( target ) {
			target.append( this.canvas )
		} else {
			document.body.append( this.canvas )
		}

		this.isMounted = true
	}

	public unMount() {
		if ( !this.isMounted ) return

		this.canvas.remove()
		this.isMounted = false
	}

	public setSize( width: number, height: number ) {
		this.canvas.width = width
		this.canvas.height = height

		Object.assign( this.canvas.style, {
			width: width + 'px',
			height: height + 'px',
		} )

		this.setViewport()
	}

	private setViewport() {
		const displayWidth = this.canvas.width
		const displayHeight = this.canvas.height
		const viewport = { ...this.viewport }

		this.viewport = {
			width: displayWidth,
			height: displayHeight,
			aspectRatio: this.viewport.width / this.viewport.height,
			deltaX: this.viewport.width - viewport.width,
			deltaY: this.viewport.height - viewport.height,
			scaleX: this.viewport.width / viewport.width,
			scaleY: this.viewport.height / viewport.height,
			scale: ( this.viewport.height * this.viewport.width ) / ( viewport.height * viewport.width ),
		}
	}
}

class GalleryImage {
	public x: number
	public y: number
	public width: number
	public height: number
	public color: RGB
	public alpha = 1

	public constructor( { x = 0, y = 0, width = 0, height = 0 }: { x: number; y: number; width: number; height: number } ) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height
		this.color = { r: 0, g: 0, b: 0 }
	}

	public get center() {
		return {
			x: this.x + this.width * 0.5,
			y: this.y + this.height * 0.5,
		}
	}
}

export class Gallery {
	private C2D: Canvas2D
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D

	public media: GalleryImage[] = []
	public bg?: GalleryImage

	public contentWidth = 0
	public selectedIndex = 0
	public previousIndex = 0
	public activePose: Pose = 'list:1'
	public previousPose: Pose = null
	public frameID?: number

	public constructor() {
		this.C2D = new Canvas2D( window.innerWidth, window.innerHeight )
		this.canvas = this.C2D.canvas
		this.ctx = this.C2D.cxt

		this.C2D.mount()

		this.getElements()
		this.attachListeners()
		this.startFrame()
		this.onResize()
	}

	public get viewport() {
		return this.C2D.viewport
	}

	private getElements() {
		const elements = <HTMLElement[]>[...document.querySelectorAll( '.box' )]

		this.media = elements.map( ( element, index ) => {
			const { top, left, width, height } = getBounds( element )

			const galleryImage: GalleryImage = new GalleryImage( {
				x: left,
				y: top,
				width,
				height,
			} )

			galleryImage.color = colors[index % colors.length]

			return galleryImage
		} )

		this.bg = <GalleryImage>{ ...this.media[this.selectedIndex] }
		this.bg.x = 0
		this.bg.y = 0
		this.bg.width = this.viewport.width
		this.bg.height = this.viewport.height
		this.bg.color = { r: 255, g: 255, b: 255 }
	}

	private attachListeners() {
		window.addEventListener( 'resize', debounce( this.onResize.bind( this ), 150 ) )
		window.addEventListener( 'keydown', this.onKeyboard.bind( this ) )
		this.canvas.addEventListener( 'click', this.onSelect.bind( this ) )
	}

	public startFrame() {
		this.frameID = requestAnimationFrame( this.update.bind( this ) )
	}

	public setPose( pose: Pose, force = false ) {
		if ( this.activePose && this.activePose === pose && !force ) return

		this.previousPose = this.activePose
		this.activePose = pose

		if ( this.bg ) {
			this.bg.x = 0
			this.bg.y = 0
			this.bg.width = this.viewport.width
			this.bg.height = this.viewport.height
		}

		// for remapping the layout i start from 0. that way it's easier to compute any offset you want.

		if ( this.activePose === 'list:1' ) {
			const width = this.viewport.height * 0.079285725
			const height = this.viewport.height * 0.04214285
			const y = this.viewport.height - height - 48

			const transition: { x: number; width: number; height: number; alpha: number }[] = []

			for ( let i = 0; i < this.media.length; i++ ) {
				const media = this.media[i]
				let x = 0
				const w = ( width / media.width ) * media.width
				const h = ( height / media.height ) * media.height

				if ( i === 0 ) {
					x = 0
				} else {
					x = i * ( w + mediaPadding )
				}

				transition.push( {
					x,
					width: w,
					height: h,
					alpha: 1,
				} )
			}

			const selectedMedia = transition[this.selectedIndex]
			const centerOffsetX = selectedMedia.x + selectedMedia.width * 0.5 - this.viewport.width * 0.5 ?? 0

			if ( this.bg ) {
				GSAP.to( this.bg.color, {
					r: 255,
					g: 255,
					b: 255,
					duration: 1,
					overwrite: 'auto',
				} )
			}

			for ( let i = 0; i < this.media.length; i++ ) {
				const media = this.media[i]
				const prop = transition[i]

				GSAP.to( media, {
					x: prop.x - centerOffsetX,
					y,
					width: prop.width,
					height: prop.height,
					alpha: prop.alpha,
					duration: 1,
					delay: i * 0.015,
					ease: 'expo.out',
					overwrite: 'auto',
				} )
			}
		}

		if ( this.activePose === 'list:2' ) {
			const width = this.viewport.height * 0.079285725
			const height = this.viewport.height * ( 0.04214285 * 7.65 ) - mediaPadding * 2
			const y = ( this.viewport.height - height ) * 0.5

			const transition: { x: number; width: number; height: number; alpha: number }[] = []

			for ( let i = 0; i < this.media.length; i++ ) {
				const media = this.media[i]
				let x = 0
				const w = ( width / media.width ) * media.width
				const h = ( height / media.height ) * media.height

				if ( i === 0 ) {
					x = 0
				} else {
					x = i * ( w + mediaPadding )
				}

				transition.push( {
					x,
					width: w,
					height: h,
					alpha: 1,
				} )
			}

			const selectedMedia = transition[this.selectedIndex]
			const centerOffsetX = selectedMedia.x + selectedMedia.width * 0.5 - this.viewport.width * 0.5 ?? 0

			if ( this.bg ) {
				GSAP.to( this.bg.color, {
					r: 255,
					g: 255,
					b: 255,
					duration: 1,
					overwrite: 'auto',
				} )
			}

			for ( let i = 0; i < this.media.length; i++ ) {
				const media = this.media[i]
				const prop = transition[i]

				GSAP.to( media, {
					x: prop.x - centerOffsetX,
					y,
					width: prop.width,
					height: prop.height,
					alpha: prop.alpha,
					duration: 1,
					delay: i * 0.01,
					ease: 'expo.out',
					overwrite: 'auto',
				} )
			}
		}

		if ( this.activePose === 'focus' ) {
			const width = clamp( this.viewport.width * ( 0.079285725 * 8.5 ) - mediaPadding * 2, 200, 900 )
			const height = width * ( 9 / 16 )
			const y = ( this.viewport.height - height ) * 0.5

			const transition: { x: number; width: number; height: number; alpha: number }[] = []

			for ( let i = 0; i < this.media.length; i++ ) {
				const media = this.media[i]
				let x = 0
				let w = ( width / media.width ) * media.width
				const h = ( height / media.height ) * media.height
				const padding = this.viewport.width * 0.079285725
				let alpha = 1

				if ( i !== this.selectedIndex ) {
					w *= 0.5
					alpha = 0.35
				}

				if ( i === 0 ) {
					x = 0
				} else {
					const previous = transition[i - 1]
					let right = 0

					if ( previous ) {
						right = previous.x + previous.width
					}

					x = right + padding
				}

				transition.push( {
					x,
					width: w,
					height: h,
					alpha,
				} )
			}

			const selectedMedia = transition[this.selectedIndex]
			const centerOffsetX = selectedMedia.x + selectedMedia.width * 0.5 - this.viewport.width * 0.5 ?? 0

			if ( this.bg ) {
				const toColor = { ...this.media[this.selectedIndex].color }

				GSAP.to( this.bg.color, {
					r: toColor.r,
					g: toColor.g,
					b: toColor.b,
					duration: 1,
					overwrite: 'auto',
				} )
			}

			for ( let i = 0; i < this.media.length; i++ ) {
				const media = this.media[i]
				const prop = transition[i]

				GSAP.to( media, {
					x: prop.x - centerOffsetX,
					y,
					width: prop.width,
					height: prop.height,
					alpha: prop.alpha,
					duration: 1.13,
					ease: 'expo.out',
					overwrite: 'auto',
				} )
			}
		}
	}

	public draw() {
		this.ctx.clearRect( 0, 0, this.viewport.width, this.viewport.height )

		if ( this.bg ) {
			this.ctx.fillStyle = toRGBString( this.bg.color )
			this.ctx.fillRect( this.bg.x, this.bg.y, this.bg.width, this.bg.height )
		}

		for ( let i = 0; i < this.media.length; i++ ) {
			const media = this.media[i]

			if ( this.activePose === 'focus' ) {
				if ( i === this.selectedIndex ) {
					this.ctx.fillStyle = 'grey'
					this.ctx.fillRect( media.x, media.y, media.width, media.height )
				} else {
					this.ctx.save()

					this.ctx.globalAlpha = media.alpha
					this.ctx.fillStyle = 'grey'
					this.ctx.fillRect( media.x, media.y, media.width, media.height )

					this.ctx.restore()
				}
			} else {
				this.ctx.fillStyle = 'grey'
				this.ctx.fillRect( media.x, media.y, media.width, media.height )
			}
		}
	}

	public update() {
		this.draw()

		this.frameID = requestAnimationFrame( this.update.bind( this ) )
	}

	public onResize() {
		this.C2D.setSize( window.innerWidth, window.innerHeight )
		this.setPose( this.activePose, true )
	}

	private onSelect( event: MouseEvent ) {
		const mouseX = event.offsetX
		const mouseY = event.offsetY
		let index: number | undefined

		for ( let i = 0; i < this.media.length; i++ ) {
			const media = this.media[i]

			if ( inRange( mouseX, null, media.x, media.x + media.width ) && inRange( mouseY, null, media.y, media.y + media.height ) ) {
				index = i
			}
		}

		if ( index == null ) return

		this.previousIndex = this.selectedIndex
		this.selectedIndex = index

		if ( this.activePose === 'list:2' ) {
			this.setPose( 'focus', true )
		} else if ( this.activePose === 'list:1' ) {
			this.setPose( 'list:2', true )
		} else if ( this.activePose === 'focus' ) {
			this.setPose( 'focus', true )
		}
	}

	private onKeyboard( event: KeyboardEvent ) {
		const { ArrowUp, ArrowDown, ArrowRight } = whichKey( event )

		if ( ArrowUp ) {
			this.setPose( 'list:2' )
		} else if ( ArrowDown ) {
			this.setPose( 'list:1' )
		} else if ( ArrowRight ) {
			this.setPose( 'focus' )
		}
	}
}

window.addEventListener( 'DOMContentLoaded', () => {
	const gallery = new Gallery()
} )

function isCanvasSupported( contextID: string ) {
	try {
		const canvas = <HTMLCanvasElement>document.createElement( 'canvas' )
		const context = <CanvasRenderingContext2D>canvas.getContext( contextID )

		return !!( canvas && context )
	} catch ( error ) {
		return false
	}
}

function whichKey( event: KeyboardEvent ) {
	const { code, keyCode } = event

	const ArrowUp = keyCode === 38 || code === 'ArrowUp'
	const ArrowDown = keyCode === 40 || code === 'ArrowDown'
	const ArrowLeft = keyCode === 37 || code === 'ArrowLeft'
	const ArrowRight = keyCode === 39 || code === 'ArrowRight'

	return {
		ArrowUp,
		ArrowDown,
		ArrowLeft,
		ArrowRight,
	}
}

function toRGBString( rgb: RGB ) {
	let r: number
	let g: number
	let b: number

	if ( Array.isArray( rgb ) ) {
		r = rgb[0]
		g = rgb[1]
		b = rgb[2]
	} else {
		r = rgb.r
		g = rgb.g
		b = rgb.b
	}

	return `rgb(  ${r}, ${g}, ${b}  )`
}
