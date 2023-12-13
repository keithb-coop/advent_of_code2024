import {promises as filesystem} from "fs";

import * as ohm from 'ohm-js'

class Diagram {
    private _lines: Map<number, Line>

    constructor(lines: Line[]) {
        this._lines = new Map()
        lines.forEach(line => this._lines.set(line.index, line))
    }

    itemAt(lineIndex: number, columnIndex: number) {
        return this._lines?.get(lineIndex)?.getItem(columnIndex)
    }
}

class Line {
    get index(): number {
        return this._index;
    }
    private readonly _index: number
    private _items: Map<number, Item>

    constructor(index: number, items: Item[]) {
        this._index = index
        this._items = new Map()
        items.forEach(item => { item.line = this; this._items.set(item.columnIndex, item)})
    }

    getItem(columnIndex: number) {
        return this._items?.get(columnIndex)
    }
}

abstract class Item {
    abstract get value(): number

    get columnIndex(): number {
        return this._columnIndex;
    }
    set line(value: Line) {
        this._line = value;
    }
    private readonly _columnIndex: number
    private _line?: Line

    get lineIndex(){
        return this._line?.index
    }
    constructor(columnIndex: number) {
        this._columnIndex = columnIndex
    }
}

abstract class NoValueItem extends Item{
    get value(): number {
        throw new Error("you shouldn't care")
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
}

class Dot extends NoValueItem{
    constructor(columnIndex: number) {
        super(columnIndex)
    }

}

class Symb extends NoValueItem {
    constructor(columnIndex: number) {
        super(columnIndex)
    }
}

// used cat Day3.txt | sed -e 's/[[:digit:]]/\./g' | sed -e 's/\.//g' to get an idea of what the "symbols" are
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

                    const partNumbers = [467]

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

                    const partNumbers = [467, 35, 633, 617, 592, 755, 664, 598]
                    const sum = 4361

                    const {grammar, semantics} = createParser()
                    const match = grammar.match(easilyParsed)
                    expect(match.succeeded()).toBeTruthy()
                    semantics(match).handleDiagram()
                })

                it("finds the answer", async () => {
                    const rawData = await filesystem.readFile('problem_sets/Day3.txt', 'utf-8')

                })
            })
        })
    })
})

export{}
