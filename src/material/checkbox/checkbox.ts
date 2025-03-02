/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterViewInit,
  Attribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Directive,
  ElementRef,
  EventEmitter,
  forwardRef,
  Inject,
  Input,
  NgZone,
  Optional,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {
  CanColor,
  CanDisable,
  CanDisableRipple,
  HasTabIndex,
  MatRipple,
  mixinColor,
  mixinDisabled,
  mixinDisableRipple,
  mixinTabIndex,
} from '@angular/material/core';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {FocusableOption, FocusOrigin} from '@angular/cdk/a11y';
import {BooleanInput, coerceBooleanProperty} from '@angular/cdk/coercion';
import {
  MAT_CHECKBOX_DEFAULT_OPTIONS,
  MAT_CHECKBOX_DEFAULT_OPTIONS_FACTORY,
  MatCheckboxDefaultOptions,
} from './checkbox-config';

/**
 * Represents the different states that require custom transitions between them.
 * @docs-private
 */
export const enum TransitionCheckState {
  /** The initial state of the component before any user interaction. */
  Init,
  /** The state representing the component when it's becoming checked. */
  Checked,
  /** The state representing the component when it's becoming unchecked. */
  Unchecked,
  /** The state representing the component when it's becoming indeterminate. */
  Indeterminate,
}

export const MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatCheckbox),
  multi: true,
};

/** Change event object emitted by checkbox. */
export class MatCheckboxChange {
  /** The source checkbox of the event. */
  source: MatCheckbox;
  /** The new `checked` value of the checkbox. */
  checked: boolean;
}

// Increasing integer for generating unique ids for checkbox components.
let nextUniqueId = 0;

// Default checkbox configuration.
const defaults = MAT_CHECKBOX_DEFAULT_OPTIONS_FACTORY();

// Boilerplate for applying mixins to MatCheckbox.
/** @docs-private */
const _MatCheckboxMixinBase = mixinTabIndex(
  mixinColor(
    mixinDisableRipple(
      mixinDisabled(
        class {
          constructor(public _elementRef: ElementRef) {}
        },
      ),
    ),
  ),
);

@Directive()
export abstract class _MatCheckboxBase<E>
  extends _MatCheckboxMixinBase
  implements
    AfterViewInit,
    ControlValueAccessor,
    CanColor,
    CanDisable,
    HasTabIndex,
    CanDisableRipple,
    FocusableOption
{
  /** Focuses the checkbox. */
  abstract focus(origin?: FocusOrigin): void;

  /** Creates the change event that will be emitted by the checkbox. */
  protected abstract _createChangeEvent(isChecked: boolean): E;

  /** Gets the element on which to add the animation CSS classes. */
  protected abstract _getAnimationTargetElement(): HTMLElement | null;

  /** CSS classes to add when transitioning between the different checkbox states. */
  protected abstract _animationClasses: {
    uncheckedToChecked: string;
    uncheckedToIndeterminate: string;
    checkedToUnchecked: string;
    checkedToIndeterminate: string;
    indeterminateToChecked: string;
    indeterminateToUnchecked: string;
  };

  /**
   * Attached to the aria-label attribute of the host element. In most cases, aria-labelledby will
   * take precedence so this may be omitted.
   */
  @Input('aria-label') ariaLabel: string = '';

  /**
   * Users can specify the `aria-labelledby` attribute which will be forwarded to the input element
   */
  @Input('aria-labelledby') ariaLabelledby: string | null = null;

  /** The 'aria-describedby' attribute is read after the element's label and field type. */
  @Input('aria-describedby') ariaDescribedby: string;

  private _uniqueId: string;

  /** A unique id for the checkbox input. If none is supplied, it will be auto-generated. */
  @Input() id: string;

  /** Returns the unique id for the visual hidden input. */
  get inputId(): string {
    return `${this.id || this._uniqueId}-input`;
  }

  /** Whether the checkbox is required. */
  @Input()
  get required(): boolean {
    return this._required;
  }
  set required(value: BooleanInput) {
    this._required = coerceBooleanProperty(value);
  }
  private _required: boolean;

  /** Whether the label should appear after or before the checkbox. Defaults to 'after' */
  @Input() labelPosition: 'before' | 'after' = 'after';

  /** Name value will be applied to the input element if present */
  @Input() name: string | null = null;

  /** Event emitted when the checkbox's `checked` value changes. */
  @Output() readonly change: EventEmitter<E> = new EventEmitter<E>();

  /** Event emitted when the checkbox's `indeterminate` value changes. */
  @Output() readonly indeterminateChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  /** The value attribute of the native input element */
  @Input() value: string;

  /** The native `<input type="checkbox">` element */
  @ViewChild('input') _inputElement: ElementRef<HTMLInputElement>;

  /** The native `<label>` element */
  @ViewChild('label') _labelElement: ElementRef<HTMLInputElement>;

  /** Reference to the ripple instance of the checkbox. */
  @ViewChild(MatRipple) ripple: MatRipple;

  /**
   * Called when the checkbox is blurred. Needed to properly implement ControlValueAccessor.
   * @docs-private
   */
  _onTouched: () => any = () => {};

  private _currentAnimationClass: string = '';

  private _currentCheckState: TransitionCheckState = TransitionCheckState.Init;

  private _controlValueAccessorChangeFn: (value: any) => void = () => {};

  constructor(
    idPrefix: string,
    elementRef: ElementRef<HTMLElement>,
    protected _changeDetectorRef: ChangeDetectorRef,
    protected _ngZone: NgZone,
    tabIndex: string,
    public _animationMode?: string,
    protected _options?: MatCheckboxDefaultOptions,
  ) {
    super(elementRef);
    this._options = this._options || defaults;
    this.color = this.defaultColor = this._options.color || defaults.color;
    this.tabIndex = parseInt(tabIndex) || 0;
    this.id = this._uniqueId = `${idPrefix}${++nextUniqueId}`;
  }

  ngAfterViewInit() {
    this._syncIndeterminate(this._indeterminate);
  }

  /** Whether the checkbox is checked. */
  @Input()
  get checked(): boolean {
    return this._checked;
  }
  set checked(value: BooleanInput) {
    const checked = coerceBooleanProperty(value);

    if (checked != this.checked) {
      this._checked = checked;
      this._changeDetectorRef.markForCheck();
    }
  }
  private _checked: boolean = false;

  /**
   * Whether the checkbox is disabled. This fully overrides the implementation provided by
   * mixinDisabled, but the mixin is still required because mixinTabIndex requires it.
   */
  @Input()
  override get disabled(): boolean {
    return this._disabled;
  }
  override set disabled(value: BooleanInput) {
    const newValue = coerceBooleanProperty(value);

    if (newValue !== this.disabled) {
      this._disabled = newValue;
      this._changeDetectorRef.markForCheck();
    }
  }
  private _disabled: boolean = false;

  /**
   * Whether the checkbox is indeterminate. This is also known as "mixed" mode and can be used to
   * represent a checkbox with three states, e.g. a checkbox that represents a nested list of
   * checkable items. Note that whenever checkbox is manually clicked, indeterminate is immediately
   * set to false.
   */
  @Input()
  get indeterminate(): boolean {
    return this._indeterminate;
  }
  set indeterminate(value: BooleanInput) {
    const changed = value != this._indeterminate;
    this._indeterminate = coerceBooleanProperty(value);

    if (changed) {
      if (this._indeterminate) {
        this._transitionCheckState(TransitionCheckState.Indeterminate);
      } else {
        this._transitionCheckState(
          this.checked ? TransitionCheckState.Checked : TransitionCheckState.Unchecked,
        );
      }
      this.indeterminateChange.emit(this._indeterminate);
    }

    this._syncIndeterminate(this._indeterminate);
  }
  private _indeterminate: boolean = false;

  _isRippleDisabled() {
    return this.disableRipple || this.disabled;
  }

  /** Method being called whenever the label text changes. */
  _onLabelTextChange() {
    // Since the event of the `cdkObserveContent` directive runs outside of the zone, the checkbox
    // component will be only marked for check, but no actual change detection runs automatically.
    // Instead of going back into the zone in order to trigger a change detection which causes
    // *all* components to be checked (if explicitly marked or not using OnPush), we only trigger
    // an explicit change detection for the checkbox view and its children.
    this._changeDetectorRef.detectChanges();
  }

  // Implemented as part of ControlValueAccessor.
  writeValue(value: any) {
    this.checked = !!value;
  }

  // Implemented as part of ControlValueAccessor.
  registerOnChange(fn: (value: any) => void) {
    this._controlValueAccessorChangeFn = fn;
  }

  // Implemented as part of ControlValueAccessor.
  registerOnTouched(fn: any) {
    this._onTouched = fn;
  }

  // Implemented as part of ControlValueAccessor.
  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  private _transitionCheckState(newState: TransitionCheckState) {
    let oldState = this._currentCheckState;
    let element = this._getAnimationTargetElement();

    if (oldState === newState || !element) {
      return;
    }
    if (this._currentAnimationClass) {
      element.classList.remove(this._currentAnimationClass);
    }

    this._currentAnimationClass = this._getAnimationClassForCheckStateTransition(
      oldState,
      newState,
    );
    this._currentCheckState = newState;

    if (this._currentAnimationClass.length > 0) {
      element.classList.add(this._currentAnimationClass);

      // Remove the animation class to avoid animation when the checkbox is moved between containers
      const animationClass = this._currentAnimationClass;

      this._ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          element!.classList.remove(animationClass);
        }, 1000);
      });
    }
  }

  private _emitChangeEvent() {
    this._controlValueAccessorChangeFn(this.checked);
    this.change.emit(this._createChangeEvent(this.checked));

    // Assigning the value again here is redundant, but we have to do it in case it was
    // changed inside the `change` listener which will cause the input to be out of sync.
    if (this._inputElement) {
      this._inputElement.nativeElement.checked = this.checked;
    }
  }

  /** Toggles the `checked` state of the checkbox. */
  toggle(): void {
    this.checked = !this.checked;
    this._controlValueAccessorChangeFn(this.checked);
  }

  protected _handleInputClick() {
    const clickAction = this._options?.clickAction;

    // If resetIndeterminate is false, and the current state is indeterminate, do nothing on click
    if (!this.disabled && clickAction !== 'noop') {
      // When user manually click on the checkbox, `indeterminate` is set to false.
      if (this.indeterminate && clickAction !== 'check') {
        Promise.resolve().then(() => {
          this._indeterminate = false;
          this.indeterminateChange.emit(this._indeterminate);
        });
      }

      this._checked = !this._checked;
      this._transitionCheckState(
        this._checked ? TransitionCheckState.Checked : TransitionCheckState.Unchecked,
      );

      // Emit our custom change event if the native input emitted one.
      // It is important to only emit it, if the native input triggered one, because
      // we don't want to trigger a change event, when the `checked` variable changes for example.
      this._emitChangeEvent();
    } else if (!this.disabled && clickAction === 'noop') {
      // Reset native input when clicked with noop. The native checkbox becomes checked after
      // click, reset it to be align with `checked` value of `mat-checkbox`.
      this._inputElement.nativeElement.checked = this.checked;
      this._inputElement.nativeElement.indeterminate = this.indeterminate;
    }
  }

  _onInteractionEvent(event: Event) {
    // We always have to stop propagation on the change event.
    // Otherwise the change event, from the input element, will bubble up and
    // emit its event object to the `change` output.
    event.stopPropagation();
  }

  _onBlur() {
    // When a focused element becomes disabled, the browser *immediately* fires a blur event.
    // Angular does not expect events to be raised during change detection, so any state change
    // (such as a form control's 'ng-touched') will cause a changed-after-checked error.
    // See https://github.com/angular/angular/issues/17793. To work around this, we defer
    // telling the form control it has been touched until the next tick.
    Promise.resolve().then(() => {
      this._onTouched();
      this._changeDetectorRef.markForCheck();
    });
  }

  private _getAnimationClassForCheckStateTransition(
    oldState: TransitionCheckState,
    newState: TransitionCheckState,
  ): string {
    // Don't transition if animations are disabled.
    if (this._animationMode === 'NoopAnimations') {
      return '';
    }

    switch (oldState) {
      case TransitionCheckState.Init:
        // Handle edge case where user interacts with checkbox that does not have [(ngModel)] or
        // [checked] bound to it.
        if (newState === TransitionCheckState.Checked) {
          return this._animationClasses.uncheckedToChecked;
        } else if (newState == TransitionCheckState.Indeterminate) {
          return this._checked
            ? this._animationClasses.checkedToIndeterminate
            : this._animationClasses.uncheckedToIndeterminate;
        }
        break;
      case TransitionCheckState.Unchecked:
        return newState === TransitionCheckState.Checked
          ? this._animationClasses.uncheckedToChecked
          : this._animationClasses.uncheckedToIndeterminate;
      case TransitionCheckState.Checked:
        return newState === TransitionCheckState.Unchecked
          ? this._animationClasses.checkedToUnchecked
          : this._animationClasses.checkedToIndeterminate;
      case TransitionCheckState.Indeterminate:
        return newState === TransitionCheckState.Checked
          ? this._animationClasses.indeterminateToChecked
          : this._animationClasses.indeterminateToUnchecked;
    }

    return '';
  }

  /**
   * Syncs the indeterminate value with the checkbox DOM node.
   *
   * We sync `indeterminate` directly on the DOM node, because in Ivy the check for whether a
   * property is supported on an element boils down to `if (propName in element)`. Domino's
   * HTMLInputElement doesn't have an `indeterminate` property so Ivy will warn during
   * server-side rendering.
   */
  private _syncIndeterminate(value: boolean) {
    const nativeCheckbox = this._inputElement;

    if (nativeCheckbox) {
      nativeCheckbox.nativeElement.indeterminate = value;
    }
  }
}

@Component({
  selector: 'mat-checkbox',
  templateUrl: 'checkbox.html',
  styleUrls: ['checkbox.css'],
  host: {
    'class': 'mat-mdc-checkbox',
    '[attr.tabindex]': 'null',
    '[attr.aria-label]': 'null',
    '[attr.aria-labelledby]': 'null',
    '[class._mat-animation-noopable]': `_animationMode === 'NoopAnimations'`,
    '[class.mdc-checkbox--disabled]': 'disabled',
    '[id]': 'id',
    // Add classes that users can use to more easily target disabled or checked checkboxes.
    '[class.mat-mdc-checkbox-disabled]': 'disabled',
    '[class.mat-mdc-checkbox-checked]': 'checked',
  },
  providers: [MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR],
  inputs: ['disableRipple', 'color', 'tabIndex'],
  exportAs: 'matCheckbox',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatCheckbox
  extends _MatCheckboxBase<MatCheckboxChange>
  implements ControlValueAccessor, CanColor, CanDisable
{
  protected _animationClasses = {
    uncheckedToChecked: 'mdc-checkbox--anim-unchecked-checked',
    uncheckedToIndeterminate: 'mdc-checkbox--anim-unchecked-indeterminate',
    checkedToUnchecked: 'mdc-checkbox--anim-checked-unchecked',
    checkedToIndeterminate: 'mdc-checkbox--anim-checked-indeterminate',
    indeterminateToChecked: 'mdc-checkbox--anim-indeterminate-checked',
    indeterminateToUnchecked: 'mdc-checkbox--anim-indeterminate-unchecked',
  };

  constructor(
    elementRef: ElementRef<HTMLElement>,
    changeDetectorRef: ChangeDetectorRef,
    ngZone: NgZone,
    @Attribute('tabindex') tabIndex: string,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
    @Optional()
    @Inject(MAT_CHECKBOX_DEFAULT_OPTIONS)
    options?: MatCheckboxDefaultOptions,
  ) {
    super(
      'mat-mdc-checkbox-',
      elementRef,
      changeDetectorRef,
      ngZone,
      tabIndex,
      animationMode,
      options,
    );
  }

  /** Focuses the checkbox. */
  focus() {
    this._inputElement.nativeElement.focus();
  }

  protected _createChangeEvent(isChecked: boolean) {
    const event = new MatCheckboxChange();
    event.source = this;
    event.checked = isChecked;
    return event;
  }

  protected _getAnimationTargetElement() {
    return this._inputElement?.nativeElement;
  }

  _onInputClick() {
    super._handleInputClick();
  }

  _onTouchTargetClick() {
    super._handleInputClick();

    if (!this.disabled) {
      // Normally the input should be focused already, but if the click
      // comes from the touch target, then we might have to focus it ourselves.
      this._inputElement.nativeElement.focus();
    }
  }

  /**
   *  Prevent click events that come from the `<label/>` element from bubbling. This prevents the
   *  click handler on the host from triggering twice when clicking on the `<label/>` element. After
   *  the click event on the `<label/>` propagates, the browsers dispatches click on the associated
   *  `<input/>`. By preventing clicks on the label by bubbling, we ensure only one click event
   *  bubbles when the label is clicked.
   */
  _preventBubblingFromLabel(event: MouseEvent) {
    if (!!event.target && this._labelElement.nativeElement.contains(event.target as HTMLElement)) {
      event.stopPropagation();
    }
  }
}
