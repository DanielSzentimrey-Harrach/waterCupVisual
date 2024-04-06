/*
 *  Power BI Visualizations
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

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsSimpleCard = formattingSettings.SimpleCard;
import FormattingSettingsCompositeCard = formattingSettings.CompositeCard;
import FormattingSettingsGroup = formattingSettings.Group;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsCompositeSlice = formattingSettings.CompositeSlice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Container Background Formatting Group
 */
class ContainerBackgroundGroupSettings extends FormattingSettingsGroup {
    backgroundColor = new formattingSettings.ColorPicker({
        name: "containerBackgroundColor",
        displayName: "Color",
        value: { value: "" },
        isNoFillItemSupported: true
    });
    
    name: string = "containerBackground";
    displayName: string = "Background";
    slices: Array<FormattingSettingsSlice> = [this.backgroundColor];
}

/**
 * Container Border Formatting Group
 */
class ContainerBorderGroupSettings extends FormattingSettingsGroup {
    borderColor = new formattingSettings.ColorPicker({
        name: "containerBorderColor",
        displayName: "Color",
        value: { value: "" },
        isNoFillItemSupported: true
    });

    borderThickness = new formattingSettings.NumUpDown({
        name: "containerBorderThickness",
        displayName: "Thickness",
        value: 1
    });
    
    name: string = "containerBorder";
    displayName: string = "Border";
    slices: Array<FormattingSettingsSlice> = [this.borderColor, this.borderThickness];
}

/**
 * Container Formatting Card
 */
class ContainerCardSettings extends FormattingSettingsCompositeCard {
    name: string = "container";
    displayName: string = "Container";

    containerBackgroundGroup = new ContainerBackgroundGroupSettings(Object());
    containerBorderGroup = new ContainerBorderGroupSettings(Object());
    groups: Array<FormattingSettingsGroup> = [this.containerBackgroundGroup, this.containerBorderGroup];
}

/**
 * Cup Canvas Formatting Group
 */
class CupCanvasGroupSettings extends FormattingSettingsGroup {
    width = new formattingSettings.NumUpDown({
        name: "canvasWidth",
        displayName: "Width",
        value: 300
    });

    height = new formattingSettings.NumUpDown({
        name: "canvasHeight",
        displayName: "Height",
        value: 300
    });

    backgroundColor = new formattingSettings.ColorPicker({
        name: "canvasBackgroundColor",
        displayName: "Background color",
        value: { value: "" },
        isNoFillItemSupported: true
    });
    
    name: string = "cupCanvas";
    displayName: string = "Canvas";
    slices: Array<FormattingSettingsSlice> = [this.width, this.height, this.backgroundColor];
}

/**
 * Cup Visual Formatting Group
 */
class CupVisualGroupSettings extends FormattingSettingsGroup {
    strokeColor = new formattingSettings.ColorPicker({
        name: "cupStrokeColor",
        displayName: "Stroke Color",
        value: { value: "#000000" },
        isNoFillItemSupported: true
    });

    strokeThickness = new formattingSettings.NumUpDown({
        name: "cupStrokeThickness",
        displayName: "Stroke Thickness",
        value: 1
    });

    waterColorLow = new formattingSettings.ColorPicker({
        name: "waterColorLow",
        displayName: "Water Color Low",
        value: { value: "#ff0000" }
    });

    waterColorHigh = new formattingSettings.ColorPicker({
        name: "waterColorHigh",
        displayName: "Water Color High",
        value: { value: "#00ff00" }
    });
    
    name: string = "cupVisual";
    displayName: string = "Visual";
    slices: Array<FormattingSettingsSlice> = [this.strokeColor, this.strokeThickness, this.waterColorLow, this.waterColorHigh];
}

/**
 * Cup Formatting Card
 */
class CupCardSettings extends FormattingSettingsCompositeCard {
    name: string = "cup";
    displayName: string = "Water Cup";

    cupCanvasGroupSettings = new CupCanvasGroupSettings(Object());
    cupVisualGroupSettings = new CupVisualGroupSettings(Object());

    groups: Array<FormattingSettingsGroup> = [this.cupCanvasGroupSettings, this.cupVisualGroupSettings];
}

/**
 * Text Category Formatting Group
 */
class TextCategoryGroupSettings extends FormattingSettingsGroup {
    categoryFormat = new formattingSettings.FontControl({
        name: "categoryTextControl",
        displayName: "Category",
        fontFamily: new formattingSettings.FontPicker({
            name: "categoryFontFamily",
            displayName: "Font Family",
            value: "Arial"
        }),
        fontSize: new formattingSettings.NumUpDown({
            name: "categoryFontSize",
            displayName: "Font Size",
            value: 24
        }),
        bold: new formattingSettings.ToggleSwitch({
            name: "categoryFontBold",
            displayName: "Bold",
            value: false
        }),
        italic: new formattingSettings.ToggleSwitch({
            name: "categoryFontItalic",
            displayName: "Italic",
            value: false
        }),
        underline: new formattingSettings.ToggleSwitch({
            name: "categoryFontUnderline",
            displayName: "Underline",
            value: false
        })
    });

    categoryColor = new formattingSettings.ColorPicker({
        name: "categoryFontColor",
        displayName: "Color",
        value: { value: "#000000" }
    });

    categoryAlignment = new formattingSettings.AlignmentGroup({
        name: "categoryFontAlignment",
        displayName: "Alignment",
        mode: powerbi.visuals.AlignmentGroupMode.Horizonal,
        value: "center"
    });
    
    name: string = "textCategory";
    displayName: string = "Category";
    slices: Array<FormattingSettingsSlice> = [this.categoryFormat, this.categoryColor, this.categoryAlignment];
}

/**
 * Text Comment Formatting Group
 */
class TextCommentGroupSettings extends FormattingSettingsGroup {
    commentFormat = new formattingSettings.FontControl({
        name: "commentTextControl",
        displayName: "Comment",
        fontFamily: new formattingSettings.FontPicker({
            name: "commentFontFamily",
            displayName: "Font Family",
            value: "Arial"
        }),
        fontSize: new formattingSettings.NumUpDown({
            name: "commentFontSize",
            displayName: "Font Size",
            value: 12
        }),
        bold: new formattingSettings.ToggleSwitch({
            name: "commentFontBold",
            displayName: "Bold",
            value: false
        }),
        italic: new formattingSettings.ToggleSwitch({
            name: "commentFontItalic",
            displayName: "Italic",
            value: false
        }),
        underline: new formattingSettings.ToggleSwitch({
            name: "commentFontUnderline",
            displayName: "Underline",
            value: false
        })
    });

    commentColor = new formattingSettings.ColorPicker({
        name: "commentFontColor",
        displayName: "Color",
        value: { value: "#000000" }
    });

    commentAlignment = new formattingSettings.AlignmentGroup({
        name: "commentFontAlignment",
        displayName: "Alignment",
        mode: powerbi.visuals.AlignmentGroupMode.Horizonal,
        value: "center"
    });
    
    name: string = "textComment";
    displayName: string = "Comment";
    slices: Array<FormattingSettingsSlice> = [this.commentFormat, this.commentColor, this.commentAlignment];
}

/**
 * Text Formatting Card
 */
class TextCardSettings extends FormattingSettingsCompositeCard {        
    name: string = "text";
    displayName: string = "Text";

    textCategoryGroupSettings = new TextCategoryGroupSettings(Object());
    textCommentGroupSettings = new TextCommentGroupSettings(Object());

    groups: Array<FormattingSettingsGroup> = [this.textCategoryGroupSettings, this.textCommentGroupSettings];
}

/**
 * Legend Formatting Card
 */
class LegendCardSettings extends FormattingSettingsSimpleCard {
    name: string = "legend";
    displayName: string = "Legend";

    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: false
    });

    heightText = new formattingSettings.TextInput({
        name: "heightText",
        displayName: "Height",
        value: "",
        placeholder: "Description of height"
    });

    widthText = new formattingSettings.TextInput({
        name: "widthText",
        displayName: "Width",
        value: "",
        placeholder: "Description of width"
    });

    waterLevelText = new formattingSettings.TextInput({
        name: "waterLevelText",
        displayName: "Water Level",
        value: "",
        placeholder: "Description of water level"
    });

    waterColorText = new formattingSettings.TextInput({
        name: "waterColorText",
        displayName: "Water Color",
        value: "",
        placeholder: "Description of water color"
    });

    legendBackgroundColor = new formattingSettings.ColorPicker({
        name: "legendBackgroundColor",
        displayName: "Background Color",
        value: { value: "" },
        isNoFillItemSupported: true
    });

    legendFontSize = new formattingSettings.NumUpDown({
        name: "legendFontSize",
        displayName: "Font Size",
        value: 12
    });

    legendFontFamily = new formattingSettings.FontPicker({
        name: "legendFontFamily",
        displayName: "Font Family",
        value: "Arial"
    });

    legendFontColor = new formattingSettings.ColorPicker({
        name: "legendFontColor",
        displayName: "Font Color",
        value: { value: "#000000" }
    });

    slices: Array<FormattingSettingsGroup> = [this.heightText, this.widthText, this.waterLevelText, this.waterColorText, this.legendBackgroundColor, this.legendFontSize, this.legendFontFamily, this.legendFontColor];
    topLevelSlice: formattingSettings.SimpleSlice<any> = this.show;
}

/**
* visual settings model class
*
*/
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    containerCard = new ContainerCardSettings();
    cupCard = new CupCardSettings();
    textCard = new TextCardSettings();
    legendCard = new LegendCardSettings();

    cards = [this.containerCard, this.cupCard, this.textCard, this.legendCard];
}