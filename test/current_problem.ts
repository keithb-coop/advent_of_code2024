import {promises as filesystem} from "fs";

import * as ohm from 'ohm-js'
import {filter, foldMap, map} from "fp-ts/Array";
import {pipe} from "fp-ts/function";
import {MonoidAny} from "fp-ts/boolean";
import {MonoidSum} from "fp-ts/number";
import {none, Option, some} from "fp-ts/Option";


class Diagram {
    private _lines: Map<number, Line>

    constructor(lines: Line[]) {
        this._lines = new Map()
        lines.forEach(line => {line.diagram = this; this._lines.set(line.index, line)})
    }

    itemAt(lineIndex: number, columnIndex: number) {
        return this._lines?.get(lineIndex)?.getItem(columnIndex)
    }

    itemsAt(...coordinates:number[][]){
        return map((pair:number[]) => this.itemAt(pair[0], pair[1]))(coordinates)
    }

    lineAbove(aLine: Line): Line | undefined {
        return this._lines.get(aLine.index - 1) // returns undefined if no such key, bounds checking not needed
    }

    lineBelow(aLine: Line): Line | undefined {
        return this._lines.get(aLine.index + 1)
    }

    get allItems(){
        const result = []
        for(const line of this._lines.values()){
            result.push(...line.allItems)
        }
        return result
    }

    static async sumOfPartNumbersInProblemSet(): Promise<number>{
        const rawData = await filesystem.readFile('problem_sets/Day3.txt', 'utf-8')
        const {grammar, semantics} = createParser()

        return pipe(semantics(grammar.match(mapLineEndings(rawData))).handleDiagram().allItems,
            filter((item: Item) => item.isNumber),
            filter((item: Item) => foldMap(MonoidAny)((neighbour: Item) => neighbour.isSymbol)(item.neighbours)),
            foldMap(MonoidSum)((item: Item) => (item as Numeric).value))
    }
}

class Line {
    set diagram(d: Diagram) {
        this._diagram = d
    }
    private _diagram?: Diagram

    get index(): number {
        return this._index
    }
    private readonly _index: number
    private _items: Map<number, Item>

    constructor(index: number, items: Item[]) {
        this._index = index
        this._items = new Map()
        items.forEach(item => { item.line = this; this._items.set(item.initialColumnIndex, item)})
    }

    getItem(columnIndex: number) {
        return this._items?.get(columnIndex)
    }

    anySuchItem(columnIndex: number): Option<Item>{
        const item = this._items.get(columnIndex)
        return (item == null ? none : some(item)) //possibly the only legit use of the ternary operator
    }

    itemToTheLeftOf(anItem: Item): Item | null {
        return this._items?.get(anItem.initialColumnIndex - 1) ?? null
    }

    itemToTheRightOf(anItem: Item): Item | null {
        return this._items?.get(anItem.finalColumnIndex + 1) ?? null

    }

    neighboursOf(anItem: Item): Item[]{
        const result = []
        for(let columnIndex = anItem.initialColumnIndex - 1; columnIndex <= anItem.finalColumnIndex + 1; columnIndex++){
            result.push(this.anySuchItem(columnIndex))
        }
        return result
    }


    get lineAbove(): Line | undefined {
        return this._diagram?.lineAbove(this)
    }

    get lineBelow(): Line | undefined {
        return this._diagram?.lineBelow(this)
    }

    get allItems(){
        return this._items.values()
    }
}

abstract class Item {
    abstract get finalColumnIndex(): number

    get neighboursAbove(): Item[] {
        return this._line?.lineAbove?.neighboursOf(this) ?? []
    }

    get neighboursOnThisLine(): Item[] {
        const result = []
        for(const maybeItem of [this._line?.itemToTheLeftOf(this) ?? null, this._line?.itemToTheRightOf(this) ?? null]) {
            if (null != maybeItem) {
                result.push(maybeItem)
            }
        }

        return result
    }

    get neighboursBelow(): Item[] {
        return this._line?.lineBelow?.neighboursOf(this) ?? []
    }

    get neighbours(): Item[] {
        const result = []
        result.push(...this.neighboursAbove, ...this.neighboursOnThisLine, ...this.neighboursBelow)
        return result
    }

    abstract get value(): number

    get initialColumnIndex(): number {
        return this._initialColumnIndex;
    }
    set line(value: Line) {
        this._line = value;
    }
    private readonly _initialColumnIndex: number
    private _line?: Line

    get lineIndex(){
        return this._line?.index
    }
    constructor(columnIndex: number) {
        this._initialColumnIndex = columnIndex
    }

    toString(){
        return `${this.constructor.name} on line ${this.lineIndex} at column ${this.initialColumnIndex}`
    }

    abstract get isNumber(): boolean

    abstract get isSymbol(): boolean
}

abstract class NotNumeric extends Item{
    get value(): number {
        throw new Error("you shouldn't care")
    }

    get finalColumnIndex(){
        return this.initialColumnIndex
    }

    get isNumber(){
        return false
    }
}

class Numeric extends Item{
    private readonly _digits: string

    constructor(columnIndex: number, digits: string) {
        super(columnIndex)
        this._digits = digits
    }

    get value(): number {
        return parseInt(this._digits);
    }

    get finalColumnIndex(){
        return this.initialColumnIndex + this._digits.length - 1
    }

    get isNumber(){
        return true
    }

    get isSymbol(): boolean{
        return false
    }
}

class Dot extends NotNumeric{
    constructor(columnIndex: number) {
        super(columnIndex)
    }

    get isSymbol(): boolean{
        return false
    }
}

class Symb extends NotNumeric {
    constructor(columnIndex: number) {
        super(columnIndex)
    }

    get isSymbol(): boolean{
        return true
    }
}

// used cat Day3.txt | sed -e 's/[[:digit:]]/\./g' | sed -e 's/\.//g' to get an idea of what the "symbols" are
// I'm suspicious of the asterixes
function createParser() {
    const grammar = ohm.grammar(String.raw`
         Schematic {
            diagram = line+
        
            line = item+ lineEnd
            lineEnd = ":"
            item = number 
                 | dot 
                 | symbol
            number = digit+
            dot = "."
            symbol = "*" 
                   | "&"
                   | "@"
                   | "#"
                   | "="
                   | "+"
                   | "-"
                   | "%"
                   | "$"
                   | "/"
        }
    `)

    let lineIndex: number
    let columnIndex: number
    const semantics = grammar.createSemantics()
    semantics.addOperation('handleDiagram',{
        diagram(lineNodeList){
            lineIndex = 0
            return new Diagram(lineNodeList.children.map(child => child.handleLine()))
        }
    }).addOperation('handleLine', {
        line(itemNodeList, _terminator){
            columnIndex = 0
            const line = new Line(lineIndex, itemNodeList.children.map(child => child.handleItem()))
            lineIndex = lineIndex + 1
            return line
        }
    }).addOperation('handleItem', {
        item(itemNode){
            let theItem
            switch(itemNode.ctorName) {
                case 'dot':
                    theItem = itemNode.handleDot()
                    columnIndex = columnIndex + 1
                    break
                case 'symbol':
                    theItem = itemNode.handleSymbol()
                    columnIndex = columnIndex + 1
                    break
                case 'number':
                    const digits = itemNode.sourceString
                    theItem = new Numeric(columnIndex, digits)
                    columnIndex = columnIndex + digits.length
                    break
            }
            return theItem
        }
    }).addOperation('handleDot', {
        dot(_){
            return new Dot(columnIndex)
        }
    }).addOperation('handleSymbol', {
        symbol(_){
            return new Symb(columnIndex)
        }
    })
    return {grammar, semantics};
}


function mapLineEndings(rawInput: string) {
    const oneLine = rawInput.replaceAll("\n",":")
    return oneLine + ":"
}

describe("Advent of Code",()=> {
    describe("using ohm", () => {
        describe("Day 3",()=> {
            describe("Part 1", () => {
                it("parses a small schematic",()=>{
                    const exampleDiagram=String.raw`467..114..
...*......`
                    const easilyParsed = mapLineEndings(exampleDiagram)

                    const {grammar, semantics} = createParser()
                    const match = grammar.match(easilyParsed)
                    expect(match.succeeded()).toBeTruthy()
                    const diagram: Diagram = semantics(match).handleDiagram()
                    expect(diagram.itemAt(0,0)).toBeInstanceOf(Numeric)
                    expect(diagram.itemAt(0,0)?.value).toEqual(467)
                    expect(diagram.itemAt(0,1)).toBeUndefined()
                    expect(diagram.itemAt(0,2)).toBeUndefined()
                    expect(diagram.itemAt(0,3)).toBeInstanceOf(Dot)
                    expect(diagram.itemAt(0,4)).toBeInstanceOf(Dot)
                    expect(diagram.itemAt(0,5)).toBeInstanceOf(Numeric)
                    expect(diagram.itemAt(0,5)?.value).toEqual(114)

                    expect(diagram.itemAt(1,2)).toBeInstanceOf(Dot)
                    expect(diagram.itemAt(1,3)).toBeInstanceOf(Symb)
                    expect(diagram.itemAt(1,4)).toBeInstanceOf(Dot)
                })

                it("finds neighbours of numbers",()=>{
                    //                      012345:012345:012345:012345
                    const data = String.raw`..*...:.123..:......:......:`

                    const {grammar, semantics} = createParser()
                    const match = grammar.match(data)
                    expect(match.succeeded()).toBeTruthy()
                    const theDiagram = semantics(match).handleDiagram()
                    const targetNumber = theDiagram.itemAt(1,1)
                    for (const item of theDiagram.itemsAt(
                        [0,0], [0,1], [0,2], [0,3], [0,4],
                        [1,0],                      [1,4],
                        [2,0], [2,1], [2,2], [2,3], [2,4])) {
                        expect(targetNumber.neighbours).toContain(item)
                        expect(targetNumber.neighbours).not.toContain(theDiagram.itemAt([1,5]))
                    }
                })

                it("parses a schematic",()=>{
                    const exampleDiagram=String.raw`467..114..
...*......
..35..633.
......#...
617*......
.....+.58.
..592.....
......755.
...$.*....
.664.598..`
                    const easilyParsed = mapLineEndings(exampleDiagram)
                    const {grammar, semantics} = createParser()
                    const match = grammar.match(easilyParsed)
                    expect(match.succeeded()).toBeTruthy()
                    const theDiagram = semantics(match).handleDiagram()

                    const partNumbers = [467, 35, 633, 617, 592, 755, 664, 598]

                    const allItems = theDiagram.allItems
                    const numberItems = filter((item: Item) => item.isNumber)(allItems)
                    const numbers = map((item: Item) => (item as Numeric).value)(numberItems)
                    for(const expectedNumber of partNumbers){
                        expect(numbers).toContain(expectedNumber)
                    }

                    const withSymbolNeigbours = filter((item: Item) => foldMap(MonoidAny)((neighbour: Item) => neighbour.isSymbol)(item.neighbours))(numberItems)
                    const withSymbolNeighbourNumbers = map((item: Item) => (item as Numeric).value)(withSymbolNeigbours)
                    for(const expectedNumber of partNumbers){
                        expect(withSymbolNeighbourNumbers).toContain(expectedNumber)
                    }
                    const sum = foldMap(MonoidSum)((item: Item) => (item as Numeric).value)(withSymbolNeigbours)
                    expect(sum).toEqual(4361)
                })

                it("finds the answer", async () => {
                    expect((await Diagram.sumOfPartNumbersInProblemSet()).valueOf()).toEqual(549908)

                })
            })
        })
    })
})

export{}
