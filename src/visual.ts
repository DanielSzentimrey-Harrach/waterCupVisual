/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionID = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import * as d3 from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;
import { VisualFormattingSettingsModel } from "./settings";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ITooltipServiceWrapper, createTooltipServiceWrapper, TooltipEventArgs } from "powerbi-visuals-utils-tooltiputils";
type VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

interface WaterCupData {
    category: string;
    comments: string;
    height: number;
    width: number;
    fillRate: number;
    colorLevel: string;
    selectionId: ISelectionID;
    tooltipInfo: Record<string, any>;
}

interface WaterCupViewModel {
    data: WaterCupData[];
}

function scaleNumber(inputMin: number, inputMax: number, outputMin: number, outputMax: number, inputValue: number, rootN: number): number {
    if (inputMin === inputMax) {
        return (outputMin + outputMax) / 2;
    }
    inputMin = Math.pow(inputMin, 1 / rootN);
    inputMax = Math.pow(inputMax, 1 / rootN);
    inputValue = Math.pow(inputValue, 1 / rootN);
    return ((inputValue - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin) + outputMin;
}

function interpolateColor(color1: string, color2: string, factor: number): string {
    const a = parseInt(color1.slice(1, 7), 16),
        b = parseInt(color2.slice(1, 7), 16),
        aR = a >> 16,
        aG = a >> 8 & 0xff,
        aB = a & 0xff,
        bR = b >> 16,
        bG = b >> 8 & 0xff,
        bB = b & 0xff,
        resultR = (aR + factor * (bR - aR)),
        resultG = (aG + factor * (bG - aG)),
        resultB = (aB + factor * (bB - aB));

    return '#' + ((1 << 24) + (resultR << 16) + (resultG << 8) + resultB).toString(16).slice(1, 7);
}

function hexToRGBA(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private maskIdCounter: number = 0;
    private selectionManager: powerbi.extensibility.ISelectionManager;
    private tooltipServiceWrapper: ITooltipServiceWrapper;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.target = options.element;
        this.selectionManager = options.host.createSelectionManager();
        options.element.style.overflow = "auto";
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
        this.handleContextMenu();
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        const dataView: powerbi.DataView = options.dataViews[0];

        this.target.textContent = '';

        if (!this.validateDataView(dataView)) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'noData';
            errorDiv.innerText = 'Please select a Category, Height, and Water Level!';
            this.target.appendChild(errorDiv);
            return;
        }
        if (!this.validateData(dataView)) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'noData';
            errorDiv.innerText = 'Please ensure that all numeric data is greater than 0!';
            this.target.appendChild(errorDiv);
            return;
        }

        const cupCanvasWidth = this.formattingSettings.cardCard.canvasGroup.width.value;
        const cupCanvasHeight = this.formattingSettings.cardCard.canvasGroup.height.value;

        const viewModel: WaterCupViewModel = this.visualTransform(dataView, cupCanvasWidth, cupCanvasHeight);

        const outerContainer = document.createElement('div');
        outerContainer.className = 'outerContainer';
        this.target.appendChild(outerContainer);

        const glassThickness = this.getGlassThickness(viewModel.data);

        for (let i = 0; i < viewModel.data.length; i++) {
            const containerDiv = document.createElement('div');
            containerDiv.style.width = cupCanvasWidth + 'px';
            containerDiv.style.padding = this.formattingSettings.cardCard.cardSpacingGroup.padding.value + 'px';
            containerDiv.style.margin = this.formattingSettings.cardCard.cardSpacingGroup.margin.value + 'px';
            containerDiv.className = 'innerContainer';
            if (this.formattingSettings.cardCard.cardBackgroundGroup.backgroundColor.value.value == null) {
                containerDiv.style.backgroundColor = "transparent"
            } else {
                containerDiv.style.backgroundColor = hexToRGBA(this.formattingSettings.cardCard.cardBackgroundGroup.backgroundColor.value.value,
                    1 - this.formattingSettings.cardCard.cardBackgroundGroup.backgroundColorTransparency.value / 100);
            }
            containerDiv.style.border = this.formattingSettings.cardCard.cardBorderGroup.borderThickness.value + 'px solid ' + this.formattingSettings.cardCard.cardBorderGroup.borderColor.value.value;
            outerContainer.appendChild(containerDiv);

            const cupDiv = document.createElement('div');
            cupDiv.style.height = cupCanvasHeight + 'px';
            cupDiv.addEventListener('click', (mouseEvent) => {
                const multiSelect = (mouseEvent as MouseEvent).ctrlKey;
                this.selectionManager.select(viewModel.data[i].selectionId, multiSelect);
            });

            const cup = this.getCup(viewModel.data[i].height, viewModel.data[i].width, viewModel.data[i].fillRate, cupCanvasWidth, cupCanvasHeight, glassThickness);
            cupDiv.appendChild(cup.node());
            const backgroundColor = this.formattingSettings.cardCard.canvasGroup.backgroundColor.value.value == null ? "transparent" : hexToRGBA(this.formattingSettings.cardCard.canvasGroup.backgroundColor.value.value,
                1 - this.formattingSettings.cardCard.canvasGroup.backgroundColorTransparency.value / 100);
            d3.select(cup.node()).style('background-color', backgroundColor);
            d3.select(cup.node()).selectAll('.filledArea').style('fill', viewModel.data[i].colorLevel);
            d3.select(cup.node()).data([viewModel.data[i].tooltipInfo]);
            containerDiv.appendChild(cupDiv);

            const categoryHeader = document.createElement('h3');
            categoryHeader.innerText = viewModel.data[i].category;
            categoryHeader.style.fontFamily = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.fontFamily.value;
            categoryHeader.style.fontSize = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.fontSize.value + 'px';
            categoryHeader.style.fontWeight = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.bold.value ? 'bold' : 'normal';
            categoryHeader.style.fontStyle = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.italic.value ? 'italic' : 'normal';
            categoryHeader.style.textDecoration = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.underline.value ? 'underline' : 'none';
            categoryHeader.style.color = this.formattingSettings.textCard.textCategoryGroupSettings.categoryColor.value.value;
            categoryHeader.style.textAlign = this.formattingSettings.textCard.textCategoryGroupSettings.categoryAlignment.value;
            containerDiv.appendChild(categoryHeader);

            if (viewModel.data[i].comments === undefined) continue;
            const commentsParagraph = document.createElement('p');
            commentsParagraph.innerText = viewModel.data[i].comments;
            commentsParagraph.style.fontFamily = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.fontFamily.value;
            commentsParagraph.style.fontSize = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.fontSize.value + 'px';
            commentsParagraph.style.fontWeight = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.bold.value ? 'bold' : 'normal';
            commentsParagraph.style.fontStyle = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.italic.value ? 'italic' : 'normal';
            commentsParagraph.style.textDecoration = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.underline.value ? 'underline' : 'none';
            commentsParagraph.style.color = this.formattingSettings.textCard.textCommentGroupSettings.commentColor.value.value;
            commentsParagraph.style.textAlign = this.formattingSettings.textCard.textCommentGroupSettings.commentAlignment.value;
            containerDiv.appendChild(commentsParagraph);
        }

        if (this.formattingSettings.legendCard.show.value) {
            const legendDiv = this.getLegend(outerContainer.offsetWidth, cupCanvasWidth, viewModel.data.length);
            this.target.appendChild(legendDiv);
        }

        this.tooltipServiceWrapper.addTooltip(
            d3.selectAll('svg'),
            (tooltipEvent: TooltipEventArgs<Record<string, any>>) => Visual.getTooltipData(tooltipEvent)
        );
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private handleContextMenu() {
        d3.select(this.target).on('contextmenu', (event: PointerEvent, dataPoint) => {
            const mouseEvent: MouseEvent = event;
            //const eventTarget: EventTarget = mouseEvent.target;
            this.selectionManager.showContextMenu(dataPoint ? dataPoint : {}, {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY
            });
            mouseEvent.preventDefault();
        });
    }

    // Validate the data view to ensure that the mandatory fields are present
    private validateDataView(dataView: DataView): boolean {
        if (!dataView || !dataView.metadata || !dataView.metadata.columns) {
            return false;
        }
        const requiredColumns = ['category', 'height', 'waterlevel'];
        const columnsInDataView = dataView.metadata.columns.map(column => Object.keys(column.roles)[0]);
        return requiredColumns.every(column => columnsInDataView.includes(column));
    }

    private validateData(dataView: DataView): boolean {
        if (!dataView || !dataView.categorical || !dataView.categorical.categories || !dataView.categorical.values) {
            return false;
        }
        for (const value of dataView.categorical.values) {
            if (value.values.some(v => (typeof v === "number" && v <= 0))) {
                return false;
            }
        }
        return true;
    }


    /* eslint-disable max-lines-per-function */
    // Disabling the ESLint check as this function is a single block of code that is not easily split into smaller functions. It's long because it's constructing each d3 object separately
    private getCup(height: number, width: number, fillRate: number, containerWidth: number, containerHeight: number, glassThickness: number): Selection<SVGElement> {
        const svg = d3.create('svg')
            .classed('ovalDiagram', true)
            .attr("width", containerWidth)
            .attr("height", containerHeight);
        const container = svg.append("g")
            .classed('cupContainer', true);

        const bottomOvalShrink = 0.9;

        const cx = containerWidth / 2;

        const topR = width / 2;
        const bottomR = topR * bottomOvalShrink;
        const bottomY = 0.975 * containerHeight - bottomR / 5;
        const cy = bottomY - height / 2;
        const topY = cy - height / 2;
        const topInnerR = topR - glassThickness;
        const bottomInnerR = bottomR + (glassThickness * (topR - bottomR) / height) - glassThickness;
        const liquidY = bottomY - glassThickness - (height - glassThickness) * fillRate
        const liquidR = bottomInnerR + (topInnerR - bottomInnerR) * fillRate;

        const strokeColor = this.formattingSettings.cupCard.cupOutlineGroupSettings.strokeColor.value.value;
        const strokeThickness = this.formattingSettings.cupCard.cupOutlineGroupSettings.strokeThickness.value;

        const glassColor = "#e4f1f7";

        /**
         * The cup is drawn in the following order:
         * 1. Bottom outer oval
         * 2. Glass wall fill
         * 3. Glass outer wall
         * 4. Bottom inner oval
         * 5. Water fill
         * 6. Glass inner wall
         * 7. Water top oval
         * 8. Upper arc
         * 9. Reflection
         */

        // Define the line generator for later use
        const line = d3.line()
            .x(function (d) { return d[0]; })
            .y(function (d) { return d[1]; });

        // 1. Bottom outer oval
        // bottomOuterOval 
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", bottomY)
            .attr("rx", bottomR)
            .attr("ry", bottomR / 5)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor)
            .style("fill", glassColor);

        // bottomOuterOvalOverlay
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", bottomY - strokeThickness)
            .attr("rx", bottomR)
            .attr("ry", bottomR / 5)
            .style("stroke-width", "none")
            .style("fill", glassColor);

        // 2. Glass wall fill
        // Left side
        let points = [
            { x: cx - topR, y: topY }, // top left 
            { x: cx - topR + glassThickness, y: topY }, // top right 
            { x: cx - bottomR + glassThickness, y: bottomY }, // bottom right 
            { x: cx - bottomR, y: bottomY }  // bottom left 
        ]

        // leftWall
        container.append("path")
            .attr("d", line(points.map(p => [p.x, p.y])))
            .style("stroke", "none")
            .style("fill", glassColor);

        // Right side
        points = [
            { x: cx + topR, y: topY }, // top left point of the top oval
            { x: cx + topR - glassThickness, y: topY }, // top right point of the top oval
            { x: cx + bottomR - glassThickness, y: bottomY }, // bottom right point of the bottom oval
            { x: cx + bottomR, y: bottomY }  // bottom left point of the bottom oval
        ]

        // rightWall
        container.append("path")
            .attr("d", line(points.map(p => [p.x, p.y])))
            .style("stroke", "none")
            .style("fill", glassColor);

        // 3. Glass outer wall
        // leftOuterLine
        container.append("line")
            .attr("x1", cx - topR)
            .attr("y1", topY)
            .attr("x2", cx - bottomR)
            .attr("y2", bottomY)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // rightOuterLine
        container.append("line")
            .attr("x1", cx + topR)
            .attr("y1", topY)
            .attr("x2", cx + bottomR)
            .attr("y2", bottomY)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // 4. Bottom inner oval
        // bottomInnerOval
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", bottomY - glassThickness)
            .attr("rx", bottomInnerR)
            .attr("ry", bottomInnerR / 5)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor)
            .classed('filledArea', true);

        // 5. Water fill
        // Define the points for the path
        points = [
            { x: cx - liquidR, y: liquidY }, // top left point of the top oval
            { x: cx + liquidR, y: liquidY }, // top right point of the top oval
            { x: cx + bottomInnerR, y: bottomY - glassThickness }, // bottom right point of the bottom oval
            { x: cx - bottomInnerR, y: bottomY - glassThickness }  // bottom left point of the bottom oval
        ];

        // Append the path and apply the line generator
        // filledArea
        container.append("path")
            .attr("d", line(points.map(p => [p.x, p.y])))
            .classed('filledArea', true)
            .style("stroke", "none");

        // 6. Glass inner wall
        // leftInnerLine
        container.append("line")
            .attr("x1", cx - topR + glassThickness)
            .attr("y1", topY)
            .attr("x2", cx - bottomInnerR)
            .attr("y2", bottomY - glassThickness)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // rightInnerLine
        container.append("line")
            .attr("x1", cx + topR - glassThickness)
            .attr("y1", topY)
            .attr("x2", cx + bottomInnerR)
            .attr("y2", bottomY - glassThickness)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // 7. Water top oval
        // liquidTopOval
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", liquidY)
            .attr("rx", liquidR)
            .attr("ry", Math.max(liquidR / 5 - glassThickness / 2, 1))
            .classed('filledArea', true)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // 8. Upper arc
        const maskId = "myMask" + this.maskIdCounter++;
        const mask = container.append("defs").append("mask").attr("id", maskId);
        mask.append("ellipse")
            .attr("cx", cx)
            .attr("cy", topY)
            .attr("rx", topR)
            .attr("ry", topR / 5)
            .style("fill", "white");

        mask.append("ellipse")
            .attr("cx", cx)
            .attr("cy", topY)
            .attr("rx", topInnerR)
            .attr("ry", Math.max(topInnerR / 5 - glassThickness / 2, 1))
            .style("fill", "black");

        // topFillOval
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", topY)
            .attr("rx", topR)
            .attr("ry", topR / 5)
            .style("stroke-width", strokeThickness)
            .style("fill", glassColor)
            .attr("mask", "url(#" + maskId + ")");

        // topOvalOuterStroke
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", topY)
            .attr("rx", topR)
            .attr("ry", topR / 5)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor)
            .style("fill", "none");

        // topOvalInnerStroke 
        container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", topY)
            .attr("rx", topInnerR)
            .attr("ry", Math.max(topInnerR / 5 - glassThickness / 2, 1))
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor)
            .style("fill", "none");

        // 9. Reflection
        points = [
            { x: cx + topR * 0.3, y: bottomY - height * 0.6 + topR / 15 }, // top left point of the top oval
            { x: cx + topR * 0.6, y: bottomY - height * 0.6 }, // top right point of the top oval
            { x: cx + bottomR * 0.6, y: bottomY - height * 0.1 }, // bottom right point of the bottom oval
            { x: cx + bottomR * 0.3, y: bottomY - height * 0.1 + bottomR / 15 }  // bottom left point of the bottom oval
        ];

        // Append the path and apply the line generator
        //reflection
        container.append("path")
            .attr("d", line(points.map(p => [p.x, p.y])))
            .style("stroke", "none")
            .style("fill", "rgba(255, 255, 255, 0.5)");

        return svg;
    }
    /* eslint-enable */

    private getLegend(outerContainerOffsetWidth: number, cupCanvasWidth: number, totalCards: number): HTMLDivElement {
        const margin = this.formattingSettings.cardCard.cardSpacingGroup.margin.value;
        const padding = this.formattingSettings.cardCard.cardSpacingGroup.padding.value;
        const borderThickness = this.formattingSettings.cardCard.cardBorderGroup.borderThickness.value;
        const outerContainerWidth = outerContainerOffsetWidth;
        const containerDivWidth = cupCanvasWidth + 2 * (margin + padding + borderThickness); // 2 * 5px margin aroound cupCanvas + 2 * 10px margin around container + 2 * border thickness
        const containerDivsPerRow = Math.min(Math.floor(outerContainerWidth / containerDivWidth), totalCards);

        const legendDiv = document.createElement('div');
        legendDiv.className = 'legendContainer';
        legendDiv.style.fontFamily = this.formattingSettings.legendCard.legendFontFamily.value;
        legendDiv.style.fontSize = this.formattingSettings.legendCard.legendFontSize.value + 'px';
        legendDiv.style.color = this.formattingSettings.legendCard.legendFontColor.value.value;
        if (this.formattingSettings.legendCard.legendBackgroundColor.value.value == null) {
            legendDiv.style.backgroundColor = "transparent"
        } else {
            legendDiv.style.backgroundColor = hexToRGBA(this.formattingSettings.legendCard.legendBackgroundColor.value.value,
                1 - this.formattingSettings.legendCard.legendBackgroundColorTransparency.value / 100);
        }
        legendDiv.style.margin = this.formattingSettings.cardCard.cardSpacingGroup.margin.value + 'px';
        legendDiv.style.padding = '5px';
        legendDiv.style.width = containerDivsPerRow * containerDivWidth - 2 * margin - 10 + 'px'; // -10 is to subtract the hardcoded padding of the outer container
        if (this.formattingSettings.legendCard.heightText.value != '') {
            const heightLegendTitle = document.createElement('b');
            heightLegendTitle.innerText = "Height: ";
            legendDiv.appendChild(heightLegendTitle);
            legendDiv.appendChild(document.createTextNode(this.formattingSettings.legendCard.heightText.value));
            legendDiv.appendChild(document.createElement('br'));
        }
        if (this.formattingSettings.legendCard.widthText.value != '') {
            const widthLegendTitle = document.createElement('b');
            widthLegendTitle.innerText = "Width: ";
            legendDiv.appendChild(widthLegendTitle);
            legendDiv.appendChild(document.createTextNode(this.formattingSettings.legendCard.widthText.value));
            legendDiv.appendChild(document.createElement('br'));
        }
        if (this.formattingSettings.legendCard.waterLevelText.value != '') {
            const waterLevelLegendTitle = document.createElement('b');
            waterLevelLegendTitle.innerText = "Water Level: ";
            legendDiv.appendChild(waterLevelLegendTitle);
            legendDiv.appendChild(document.createTextNode(this.formattingSettings.legendCard.waterLevelText.value));
            legendDiv.appendChild(document.createElement('br'));
        }
        if (this.formattingSettings.legendCard.waterColorText.value != '') {
            const waterColorLegendTitle = document.createElement('b');
            waterColorLegendTitle.innerText = "Water Color: ";
            legendDiv.appendChild(waterColorLegendTitle);
            legendDiv.appendChild(document.createTextNode(this.formattingSettings.legendCard.waterColorText.value));
            legendDiv.appendChild(document.createElement('br'));
        }

        return legendDiv;
    }

    private getGlassThickness(data: WaterCupData[]): number {
        const glassThickness = data.reduce((prev, curr) => {
            return Math.min(prev, curr.width * 0.05);
        }, 15);
        return Math.max(glassThickness, 6);
    }

    private visualTransform(dataView: powerbi.DataView, width: number, height: number): WaterCupViewModel {
        const viewModel: WaterCupViewModel = {
            data: []
        };

        // Determine which data roles are present in the data view and identify their indeces
        const commentsIndex = dataView.categorical.values.map(value => value.source.roles).findIndex(roles => Object.prototype.hasOwnProperty.call(roles, 'categoryComments'));
        const heightIndex = dataView.categorical.values.map(value => value.source.roles).findIndex(roles => Object.prototype.hasOwnProperty.call(roles, 'height'));
        const widthIndexRaw = dataView.categorical.values.map(value => value.source.roles).findIndex(roles => Object.prototype.hasOwnProperty.call(roles, 'width'));
        // if there is no width data specified, we'll use the values from height to determine the relative widths
        const widthIndex = widthIndexRaw === -1 ? heightIndex : widthIndexRaw;
        const waterLevelIndex = dataView.categorical.values.map(value => value.source.roles).findIndex(roles => Object.prototype.hasOwnProperty.call(roles, 'waterlevel'));
        const colorLevelIndex = dataView.categorical.values.map(value => value.source.roles).findIndex(roles => Object.prototype.hasOwnProperty.call(roles, 'watercolor'));

        const categories = dataView.categorical.categories[0];
        const comments = dataView.categorical.values[commentsIndex];
        const rawHeights = dataView.categorical.values[heightIndex];
        const rawHeightMin = this.formattingSettings.cupCard.cupHeightRangeGroupSettings.cupHeightRangeMin.value ?? <number>dataView.categorical.values[heightIndex].minLocal;
        const rawHeightMax = this.formattingSettings.cupCard.cupHeightRangeGroupSettings.cupHeightRangeMax.value ?? <number>dataView.categorical.values[heightIndex].maxLocal;
        const rawWidths = dataView.categorical.values[widthIndex];
        const rawWidthMin = this.formattingSettings.cupCard.cupWidthRangeGroupSettings.cupWidthRangeMin.value ?? <number>dataView.categorical.values[widthIndex].minLocal;
        const rawWidthMax = this.formattingSettings.cupCard.cupWidthRangeGroupSettings.cupWidthRangeMax.value ?? <number>dataView.categorical.values[widthIndex].maxLocal;
        const rawWaterLevel = dataView.categorical.values[waterLevelIndex];
        const rawWaterLevelMin = this.formattingSettings.cupCard.cupWaterLevelRangeGroupSettings.cupWaterLevelRangeMin.value ?? <number>dataView.categorical.values[waterLevelIndex].minLocal;
        const rawWaterLevelMax = this.formattingSettings.cupCard.cupWaterLevelRangeGroupSettings.cupWaterLevelRangeMax.value ?? <number>dataView.categorical.values[waterLevelIndex].maxLocal;
        let rawColorLevels: any;
        let rawColorLevelsMin = 1;
        let rawColorLevelsMax = 1;
        if (colorLevelIndex !== -1) {
            rawColorLevels = dataView.categorical.values[colorLevelIndex];
            rawColorLevelsMin = this.formattingSettings.cupCard.cupWaterColorGroupSettings.cupWaterColorRangeMin.value ?? <number>dataView.categorical.values[colorLevelIndex].minLocal;
            rawColorLevelsMax = this.formattingSettings.cupCard.cupWaterColorGroupSettings.cupWaterColorRangeMax.value ?? <number>dataView.categorical.values[colorLevelIndex].maxLocal;
        }

        const maxHeight = height * 0.8;
        const minHeight = height * 0.2;
        const maxWidth = Math.min(1.5 * height / 1.9, width * 0.95);
        const minWidth = width * 0.4;
        for (let i = 0; i < categories.values.length; i++) {
            let colorLevel = this.formattingSettings.cupCard.cupWaterColorGroupSettings.waterColorLow.value.value;
            if (colorLevelIndex !== -1) {
                colorLevel = interpolateColor(this.formattingSettings.cupCard.cupWaterColorGroupSettings.waterColorLow.value.value,
                    this.formattingSettings.cupCard.cupWaterColorGroupSettings.waterColorHigh.value.value,
                    scaleNumber(rawColorLevelsMin, rawColorLevelsMax, 0, 1, <number>rawColorLevels.values[i], 1));
            }
            const tooltipData = {
                [rawHeights.source.displayName]: rawHeights.values[i],
                [rawWaterLevel.source.displayName]: rawWaterLevel.values[i]
            }

            if (widthIndexRaw !== -1) {
                tooltipData[rawWidths.source.displayName] = rawWidths.values[i];
            }
            if (colorLevelIndex !== -1) {
                tooltipData[rawColorLevels.source.displayName] = rawColorLevels.values[i];
            }

            viewModel.data.push({
                category: <string>categories.values[i],
                comments: <string>comments?.values[i] ?? undefined,
                height: scaleNumber(rawHeightMin, rawHeightMax, minHeight, maxHeight, <number>rawHeights.values[i], 3),
                width: scaleNumber(rawWidthMin, rawWidthMax, minWidth, maxWidth, <number>rawWidths.values[i], 3),
                fillRate: scaleNumber(rawWaterLevelMin, rawWaterLevelMax, 0.1, 0.9, <number>rawWaterLevel.values[i], 1),
                colorLevel: colorLevel,
                selectionId: this.host.createSelectionIdBuilder().withCategory(categories, i).createSelectionId(),
                tooltipInfo: tooltipData
            });
        }
        return viewModel;
    }

    private static getTooltipData(value: Record<string, any>): VisualTooltipDataItem[] {
        const visualTooltipDataItems: VisualTooltipDataItem[] = [];
        for (const key in value) {
            visualTooltipDataItems.push({
                displayName: key,
                value: value[key].toString()
            });
        }
        return visualTooltipDataItems;
    }
}