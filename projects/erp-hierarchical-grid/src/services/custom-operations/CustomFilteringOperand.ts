import { IgrStringFilteringOperand } from "igniteui-react-grids";

export class FullAddressFilteringOperand extends IgrStringFilteringOperand {
  public constructor(isAddressShort: boolean = false) {
    super();
    const getShortAddress = (target: any) => `${target.streetNumber} ${target.streetName}`;
    const getFullAddress = (target: any) => `${target.streetNumber} ${target.streetName}, ${target.zipCode} ${target.city}, ${target.country}`;

    const customOperations = [
      {
        iconName: 'filter_contains',
        isUnary: false,
        logic: (target: any, searchVal: string, ignoreCase?: boolean) => {
          const address = isAddressShort ? getShortAddress(target) : getFullAddress(target);
          ignoreCase = true;
          const search = IgrStringFilteringOperand.applyIgnoreCase(searchVal, ignoreCase);
          target = IgrStringFilteringOperand.applyIgnoreCase(address, ignoreCase);
          return target.indexOf(search) !== -1;
        },
        name: 'Contains'
      },
      {
        iconName: 'filter_does_not_contain',
        isUnary: false,
        logic: (target: any, searchVal: string, ignoreCase?: boolean) => {
          const address = isAddressShort ? getShortAddress(target) : getFullAddress(target);
          ignoreCase = true;
          const search = IgrStringFilteringOperand.applyIgnoreCase(searchVal, ignoreCase);
          target = IgrStringFilteringOperand.applyIgnoreCase(address, ignoreCase);
          return target.indexOf(search) === -1;
        },
        name: 'Does Not Contain'
      },
      {
        iconName: 'filter_starts_with',
        isUnary: false,
        logic: (target: any, searchVal: string, ignoreCase?: boolean) => {
          const address = isAddressShort ? getShortAddress(target) : getFullAddress(target);
          ignoreCase = true;
          const search = IgrStringFilteringOperand.applyIgnoreCase(searchVal, ignoreCase);
          target = IgrStringFilteringOperand.applyIgnoreCase(address, ignoreCase);
          return target.startsWith(search);
        },
        name: 'Starts With'
      },
      {
        iconName: 'filter_ends_with',
        isUnary: false,
        logic: (target: any, searchVal: string, ignoreCase?: boolean) => {
          const address = isAddressShort ? getShortAddress(target) : getFullAddress(target);
          ignoreCase = true;
          const search = IgrStringFilteringOperand.applyIgnoreCase(searchVal, ignoreCase);
          target = IgrStringFilteringOperand.applyIgnoreCase(address, ignoreCase);
          return target.endsWith(search);
        },
        name: 'Ends With'
      },
      {
        iconName: 'filter_equal',
        isUnary: false,
        logic: (target: any, searchVal: string, ignoreCase?: boolean) => {
          const address = isAddressShort ? getShortAddress(target) : getFullAddress(target);
          ignoreCase = true;
          const search = IgrStringFilteringOperand.applyIgnoreCase(searchVal, ignoreCase);
          target = IgrStringFilteringOperand.applyIgnoreCase(address, ignoreCase);
          return target === search;
        },
        name: 'Equals'
      },
      {
        iconName: 'filter_not_equal',
        isUnary: false,
        logic: (target: any, searchVal: string, ignoreCase?: boolean) => {
          const address = isAddressShort ? getShortAddress(target) : getFullAddress(target);
          ignoreCase = true;
          const search = IgrStringFilteringOperand.applyIgnoreCase(searchVal, ignoreCase);
          target = IgrStringFilteringOperand.applyIgnoreCase(address, ignoreCase);
          return target !== search;
        },
        name: 'Does Not Equal'
      },
    ];

    const emptyOperators = [
      // 'Empty'
      this.operations[6],
      // 'Not Empty'
      this.operations[7],
      // 'Null'
      this.operations[8],
      // 'Not Null'
      this.operations[9],
    ];

    // this.operations = customOperations.concat(emptyOperators);
    this.operations = [...customOperations, ...emptyOperators];
  }
}